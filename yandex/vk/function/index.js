const crypto = require("node:crypto");
const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client({
  region: "ru-central1",
  endpoint: "https://storage.yandexcloud.net",
});

const BUCKET = "cosmetology-publisher-images";
const TEST_ARTIFACT_ID = "test-artifact-001";
const TEST_IMAGE_KEY = `artifacts/${TEST_ARTIFACT_ID}/cosmo-sofa.svg`;
const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function response(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

function binaryResponse(bytes, contentType) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": contentType || "application/octet-stream",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
    body: Buffer.from(bytes).toString("base64"),
    isBase64Encoded: true,
  };
}

function pathOf(event) {
  return event?.path || event?.rawPath || event?.requestContext?.http?.path || "";
}

function methodOf(event) {
  return String(event?.httpMethod || event?.requestContext?.http?.method || "GET").toUpperCase();
}

function headersOf(event) {
  const source = event?.headers || {};
  const result = {};
  for (const [key, value] of Object.entries(source)) result[String(key).toLowerCase()] = String(value);
  return result;
}

function jsonBody(event) {
  const raw = event?.body || "";
  if (!raw) return {};
  const text = event?.isBase64Encoded ? Buffer.from(raw, "base64").toString("utf8") : raw;
  return JSON.parse(text);
}

function requireReplicaAuth(event) {
  const expected = process.env.REPLICA_TOKEN || "";
  if (!expected) throw Object.assign(new Error("Replica token is not configured"), { statusCode: 503, code: "REPLICA_NOT_CONFIGURED" });
  const authorization = headersOf(event).authorization || "";
  const supplied = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    throw Object.assign(new Error("Invalid replica token"), { statusCode: 401, code: "INVALID_REPLICA_TOKEN" });
  }
}

function hashHandoff(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function assertArtifactId(value) {
  const id = String(value || "");
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(id)) throw Object.assign(new Error("Invalid artifact id"), { statusCode: 400, code: "INVALID_ARTIFACT_ID" });
  return id;
}

function assertHandoffToken(value) {
  const token = String(value || "");
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) throw Object.assign(new Error("Invalid handoff token"), { statusCode: 400, code: "INVALID_HANDOFF" });
  return token;
}

function extensionFor(contentType) {
  return ({
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  })[String(contentType || "").toLowerCase()] || "bin";
}

async function putJson(key, value) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: JSON.stringify(value),
    ContentType: "application/json; charset=utf-8",
    CacheControl: "no-store",
  }));
}

async function getJson(key) {
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return JSON.parse(await object.Body.transformToString());
  } catch (error) {
    if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

async function artifactByHandoff(token) {
  const alias = await getJson(`handoffs/${hashHandoff(token)}.json`);
  if (!alias?.artifactId) return null;
  return getJson(`artifacts/${alias.artifactId}/artifact.json`);
}

async function initReplica(event) {
  requireReplicaAuth(event);
  const body = jsonBody(event);
  const artifactId = assertArtifactId(body.artifactId);
  const handoffToken = assertHandoffToken(body.handoffToken);
  const version = Math.max(1, Number(body.version) || 1);
  const vkGroupId = Number(body.vkGroupId);
  const text = typeof body.text === "string" ? body.text : "";
  const expiresAt = String(body.expiresAt || "");
  const images = Array.isArray(body.images) ? body.images : [];

  if (!Number.isInteger(vkGroupId) || vkGroupId <= 0) throw Object.assign(new Error("Invalid VK group"), { statusCode: 400, code: "INVALID_VK_GROUP" });
  if (!expiresAt || !Number.isFinite(Date.parse(expiresAt))) throw Object.assign(new Error("Invalid artifact expiry"), { statusCode: 400, code: "INVALID_EXPIRY" });
  if (images.length > MAX_IMAGES) throw Object.assign(new Error("Too many images"), { statusCode: 400, code: "TOO_MANY_IMAGES" });

  const normalizedImages = images.map((image, index) => {
    const sourceIndex = Number(image?.index);
    const contentType = String(image?.contentType || "application/octet-stream").toLowerCase();
    const size = Number(image?.size) || 0;
    if (sourceIndex !== index || size <= 0 || size > MAX_IMAGE_BYTES) throw Object.assign(new Error(`Invalid image ${index}`), { statusCode: 400, code: "INVALID_IMAGE" });
    const ext = extensionFor(contentType);
    if (ext === "bin") throw Object.assign(new Error(`Unsupported image ${index}`), { statusCode: 415, code: "UNSUPPORTED_IMAGE_TYPE" });
    return { index, contentType, size, key: `artifacts/${artifactId}/images/${String(index).padStart(2, "0")}.${ext}` };
  });

  const artifact = {
    artifactId,
    version,
    status: "replicating_ru",
    vkGroupId,
    text,
    expiresAt,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    images: normalizedImages.map(({ index, contentType, size, key }) => ({ index, contentType, size, key })),
  };

  await putJson(`artifacts/${artifactId}/artifact.json`, artifact);
  await putJson(`handoffs/${hashHandoff(handoffToken)}.json`, { artifactId, version, expiresAt });

  const uploads = [];
  for (const image of normalizedImages) {
    const url = await getSignedUrl(s3, new PutObjectCommand({
      Bucket: BUCKET,
      Key: image.key,
      ContentType: image.contentType,
      CacheControl: "private, max-age=300",
    }), { expiresIn: 10 * 60 });
    uploads.push({ index: image.index, url });
  }

  return response(200, { artifactId, status: artifact.status, uploads });
}

async function completeReplica(event, artifactId) {
  requireReplicaAuth(event);
  artifactId = assertArtifactId(artifactId);
  const body = jsonBody(event);
  const handoffToken = assertHandoffToken(body.handoffToken);
  const aliasKey = `handoffs/${hashHandoff(handoffToken)}.json`;
  const alias = await getJson(aliasKey);
  if (!alias || alias.artifactId !== artifactId) throw Object.assign(new Error("Artifact handoff mismatch"), { statusCode: 409, code: "ARTIFACT_HANDOFF_MISMATCH" });

  const key = `artifacts/${artifactId}/artifact.json`;
  const artifact = await getJson(key);
  if (!artifact) throw Object.assign(new Error("Artifact not found"), { statusCode: 404, code: "ARTIFACT_NOT_FOUND" });
  artifact.status = "ready";
  artifact.updatedAt = new Date().toISOString();
  await putJson(key, artifact);
  return response(200, { artifactId, status: "ready" });
}

async function getArtifact(token) {
  token = assertHandoffToken(token);
  const artifact = await artifactByHandoff(token);
  if (!artifact) return response(404, { error: { code: "ARTIFACT_NOT_FOUND", message: "Публикация не найдена" } });
  if (Date.parse(artifact.expiresAt) <= Date.now()) return response(410, { error: { code: "ARTIFACT_EXPIRED", message: "Ссылка публикации истекла" } });
  if (artifact.status !== "ready") return response(409, { error: { code: "ARTIFACT_NOT_READY", message: "Публикация ещё синхронизируется" }, status: artifact.status });
  return response(200, {
    artifactId: artifact.artifactId,
    version: artifact.version,
    status: artifact.status,
    vkGroupId: artifact.vkGroupId,
    text: artifact.text,
    expiresAt: artifact.expiresAt,
    images: artifact.images.map((image) => `/api/artifacts/${encodeURIComponent(token)}/images/${image.index}`),
  });
}

async function getArtifactImage(token, index) {
  token = assertHandoffToken(token);
  const artifact = await artifactByHandoff(token);
  if (!artifact || artifact.status !== "ready" || Date.parse(artifact.expiresAt) <= Date.now()) return response(404, { error: { code: "IMAGE_NOT_FOUND" } });
  const image = artifact.images.find((item) => Number(item.index) === Number(index));
  if (!image) return response(404, { error: { code: "IMAGE_NOT_FOUND" } });
  const object = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: image.key }));
  const bytes = await object.Body.transformToByteArray();
  return binaryResponse(bytes, object.ContentType || image.contentType);
}

async function getTestArtifact(path) {
  if (path.endsWith("/image")) {
    const object = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: TEST_IMAGE_KEY }));
    return binaryResponse(await object.Body.transformToByteArray(), object.ContentType || "image/svg+xml");
  }
  return response(200, {
    artifactId: TEST_ARTIFACT_ID,
    status: "ready",
    text: "Тестовая публикация Cosmo Sofa",
    images: ["/api/test-artifact/image"],
  });
}

module.exports.handler = async function (event) {
  const path = pathOf(event);
  const method = methodOf(event);

  try {
    if (method === "POST" && path === "/api/replica/artifacts/init") return initReplica(event);

    const completeMatch = path.match(/^\/api\/replica\/artifacts\/([A-Za-z0-9_-]+)\/complete$/);
    if (method === "POST" && completeMatch) return completeReplica(event, completeMatch[1]);

    const imageMatch = path.match(/^\/api\/artifacts\/([A-Za-z0-9_-]+)\/images\/(\d+)$/);
    if (method === "GET" && imageMatch) return getArtifactImage(imageMatch[1], Number(imageMatch[2]));

    const artifactMatch = path.match(/^\/api\/artifacts\/([A-Za-z0-9_-]+)$/);
    if (method === "GET" && artifactMatch) return getArtifact(artifactMatch[1]);

    if (method === "GET" && (path === "/api/test-artifact" || path === "/api/test-artifact/image")) return getTestArtifact(path);

    return response(404, { error: { code: "NOT_FOUND", message: "Route not found" } });
  } catch (error) {
    console.error("Yandex VK function error", error);
    return response(error?.statusCode || 500, {
      error: {
        code: error?.code || "INTERNAL_ERROR",
        message: error?.message || "Internal error",
      },
    });
  }
};
