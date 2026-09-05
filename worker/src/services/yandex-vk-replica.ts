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

type ImageDescriptor = {
  index: number;
  contentType: string;
  size: number;
  sourceUrl: string;
};

function missingConfig(env: Env) {
  const required = {
    YANDEX_VK_BASE_URL: env.YANDEX_VK_BASE_URL,
    YANDEX_REPLICA_TOKEN: env.YANDEX_REPLICA_TOKEN,
    R2_S3_ENDPOINT: env.R2_S3_ENDPOINT,
    R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
  };

  return Object.entries(required)
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

function rfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function hmac(key: string | ArrayBuffer, value: string) {
  const rawKey = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey('raw', rawKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value));
}

async function presignR2Get(env: Env, key: string, expiresSeconds = 15 * 60) {
  const endpoint = new URL(env.R2_S3_ENDPOINT!);
  if (endpoint.protocol !== 'https:') throw new Error('R2_S3_ENDPOINT must use HTTPS');

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const bucket = 'cosmetology-publisher-images';
  const canonicalUri = `/${rfc3986(bucket)}/${key.split('/').map(rfc3986).join('/')}`;

  const query = new URLSearchParams();
  query.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  query.set('X-Amz-Credential', `${env.R2_ACCESS_KEY_ID}/${scope}`);
  query.set('X-Amz-Date', amzDate);
  query.set('X-Amz-Expires', String(expiresSeconds));
  query.set('X-Amz-SignedHeaders', 'host');
  const queryEntries: Array<[string,string]> = [];
  query.forEach((value,name)=>queryEntries.push([name,value]));
  const canonicalQuery = queryEntries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${rfc3986(name)}=${rfc3986(value)}`)
    .join('&');

  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQuery,
    `host:${endpoint.host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256(canonicalRequest)].join('\n');

  const dateKey = await hmac(`AWS4${env.R2_SECRET_ACCESS_KEY}`, dateStamp);
  const regionKey = await hmac(dateKey, region);
  const serviceKey = await hmac(regionKey, service);
  const signingKey = await hmac(serviceKey, 'aws4_request');
  const signature = hex(await hmac(signingKey, stringToSign));

  return `${endpoint.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

async function objectDescriptor(env: Env, key: string, index: number): Promise<ImageDescriptor> {
  const object = await env.IMAGES.head(key);
  if (!object) throw new Error(`Replica source image missing: ${key}`);
  return {
    index,
    contentType: object.httpMetadata?.contentType || 'application/octet-stream',
    size: object.size,
    sourceUrl: await presignR2Get(env, key),
  };
}

async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

export async function replicateVkArtifactToYandex(env: Env, artifact: YandexReplicaArtifact) {
  const missing = missingConfig(env);
  if (missing.length) {
    console.log('Yandex VK replica skipped: missing configuration', { missing });
    return;
  }

  const base = env.YANDEX_VK_BASE_URL!.replace(/\/+$/, '');
  const images = await Promise.all(artifact.imageKeys.map((key, index) => objectDescriptor(env, key, index)));
  const body = JSON.stringify({
    artifactId: artifact.artifactId,
    handoffToken: artifact.handoffToken,
    version: artifact.version,
    vkGroupId: artifact.vkGroupId,
    text: artifact.text,
    expiresAt: artifact.expiresAt,
    images,
  });

  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${base}/api/replica/artifacts/init`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.YANDEX_REPLICA_TOKEN}`,
          'content-type': 'application/json',
        },
        body,
      });
      const raw = await response.text();
      if (!response.ok) throw new Error(`Yandex replica init failed ${response.status}: ${raw.slice(0, 1000)}`);
      console.log('Yandex VK artifact replicated by pull', {
        artifactId: artifact.artifactId,
        imageCount: images.length,
        version: artifact.version,
        attempt,
      });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < 3) await sleep(500 * 2 ** (attempt - 1));
    }
  }

  throw new Error(`Yandex VK pull replication failed after retries: ${lastError}`);
}
