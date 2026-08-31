import type { Env } from '../types';

export type YandexReplicaArtifact = {
  artifactId: string;
  handoffToken: string;
  version: number;
  vkGroupId: number;
  text: string;
  expiresAt: string;
  imageKeys: string[];
};

type InitResponse = {
  artifactId: string;
  uploads: Array<{ index: number; url: string }>;
};

function enabled(env: Env) {
  return Boolean(env.YANDEX_VK_BASE_URL && env.YANDEX_REPLICA_TOKEN);
}

async function objectDescriptor(env: Env, key: string, index: number) {
  const object = await env.IMAGES.get(key);
  if (!object) throw new Error(`Replica source image missing: ${key}`);
  return {
    index,
    contentType: object.httpMetadata?.contentType || 'application/octet-stream',
    size: object.size,
    object,
  };
}

export async function replicateVkArtifactToYandex(env: Env, artifact: YandexReplicaArtifact) {
  if (!enabled(env)) {
    console.log('Yandex VK replica skipped: YANDEX_VK_BASE_URL or YANDEX_REPLICA_TOKEN missing');
    return;
  }

  const base = env.YANDEX_VK_BASE_URL!.replace(/\/+$/, '');
  const images = await Promise.all(artifact.imageKeys.map((key, index) => objectDescriptor(env, key, index)));
  const headers = {
    authorization: `Bearer ${env.YANDEX_REPLICA_TOKEN}`,
    'content-type': 'application/json',
  };

  const initResponse = await fetch(`${base}/api/replica/artifacts/init`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      artifactId: artifact.artifactId,
      handoffToken: artifact.handoffToken,
      version: artifact.version,
      vkGroupId: artifact.vkGroupId,
      text: artifact.text,
      expiresAt: artifact.expiresAt,
      images: images.map(({ index, contentType, size }) => ({ index, contentType, size })),
    }),
  });

  const initRaw = await initResponse.text();
  if (!initResponse.ok) throw new Error(`Yandex replica init failed ${initResponse.status}: ${initRaw.slice(0, 1000)}`);
  const init = JSON.parse(initRaw) as InitResponse;

  for (const upload of init.uploads || []) {
    const source = images[upload.index];
    if (!source) throw new Error(`Yandex replica returned invalid image index ${upload.index}`);
    const blob = await source.object.blob();
    const uploadResponse = await fetch(upload.url, {
      method: 'PUT',
      headers: { 'content-type': source.contentType },
      body: blob,
    });
    if (!uploadResponse.ok) {
      const raw = await uploadResponse.text();
      throw new Error(`Yandex replica image ${upload.index} failed ${uploadResponse.status}: ${raw.slice(0, 500)}`);
    }
  }

  const completeResponse = await fetch(`${base}/api/replica/artifacts/${encodeURIComponent(artifact.artifactId)}/complete`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ handoffToken: artifact.handoffToken, version: artifact.version }),
  });
  const completeRaw = await completeResponse.text();
  if (!completeResponse.ok) throw new Error(`Yandex replica complete failed ${completeResponse.status}: ${completeRaw.slice(0, 1000)}`);

  console.log('Yandex VK artifact replicated', {
    artifactId: artifact.artifactId,
    imageCount: images.length,
    version: artifact.version,
  });
}
