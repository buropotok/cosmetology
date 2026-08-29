import worker from './index';
import { vkMiniAppHtml } from './vk-miniapp';
import type { Env } from './types';

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

    return worker.fetch(req, env);
  },
};
