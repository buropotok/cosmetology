import worker from './index';
import { vkMiniAppHtml } from './vk-miniapp';
import type { Env } from './types';

const VK_TEST_IMAGE_KEY = 'posts/2026/08/10.png';

export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);

    if (
      req.method === 'GET' &&
      (url.pathname === '/vk-test' || url.pathname === '/vk-test/')
    ) {
      return new Response(vkMiniAppHtml, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        },
      });
    }

    if (req.method === 'GET' && url.pathname === '/vk-test-image') {
      const object = await env.IMAGES.get(VK_TEST_IMAGE_KEY);

      if (!object) {
        return new Response('Not found', { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('cache-control', 'public, max-age=300');
      headers.set('x-content-type-options', 'nosniff');

      return new Response(object.body, { headers });
    }

    return worker.fetch(req, env);
  },
};
