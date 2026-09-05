import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const flow = readFileSync(new URL('../../miniapp/vk-publish-flow.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../../miniapp/bootstrap.js', import.meta.url), 'utf8');

describe('VK publish preparation flow', () => {
  it('loads after composer actions', () => {
    expect(bootstrap.indexOf("import('/composer-actions.js')")).toBeLessThan(bootstrap.indexOf("import('/vk-publish-flow.js')"));
  });

  it('downloads every draft image instead of only the first image', () => {
    expect(flow).toContain("data?.draft?.images||[]");
    expect(flow).toContain('for(let i=0;i<images.length;i++)');
    expect(flow).not.toContain('images?.[0]');
  });

  it('shows the VPN continuation modal only after image preparation', () => {
    expect(flow).toContain('Фото скачаны');
    expect(flow).toContain('Отключите VPN, чтобы продолжить.');
    expect(flow.indexOf('await downloadImage(images[i])')).toBeLessThan(flow.indexOf('showModal(vkUrl'));
  });

  it('opens the prepared VK link without post id handling', () => {
    expect(flow).toContain("fetch('/api/miniapp/vk-link'");
    expect(flow).toContain('tg.openLink(vkUrl');
    expect(flow).not.toContain('post_id');
    expect(flow).not.toContain('VKWebAppShowWallPostBox');
  });
});
