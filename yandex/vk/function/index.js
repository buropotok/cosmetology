const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  region: "ru-central1",
  endpoint: "https://storage.yandexcloud.net",
});

const BUCKET = "cosmetology-publisher-images";
const ARTIFACT_ID = "test-artifact-001";
const IMAGE_KEY = `artifacts/${ARTIFACT_ID}/cosmo-sofa.svg`;

module.exports.handler = async function (event) {
  const path = event?.path || event?.rawPath || "";

  if (path.endsWith("/image")) {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: IMAGE_KEY,
      })
    );

    const bytes = await response.Body.transformToByteArray();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store",
      },
      body: Buffer.from(bytes).toString("base64"),
      isBase64Encoded: true,
    };
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify({
      artifactId: ARTIFACT_ID,
      text: "Тестовая публикация Cosmo Sofa",
      images: ["/api/test-artifact/image"],
    }),
  };
};
