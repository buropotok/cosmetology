import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const html = readFileSync(new URL('../../site/auth/index.html', import.meta.url), 'utf8');

describe('VK ID diagnostic frontend', () => {
  it('uses an in-memory Authorization Code + PKCE flow without frontend token exchange', () => {
    expect(html).not.toContain('VKID.Auth.exchangeCode');
    expect(html).not.toContain('access_token');
    expect(html).not.toContain('refresh_token');
    expect(html).not.toContain('id_token');
    expect(html).not.toContain('localStorage');
    expect(html).not.toContain('sessionStorage');
    expect(html).toContain("crypto.subtle.digest('SHA-256'");
    expect(html).toContain('const challenge = await codeChallenge(codeVerifier)');
    expect(html).toContain('code_challenge: challenge');
    expect(html).toContain("code_challenge_method: 'S256'");
    expect(html).toContain('code_verifier: authorizationTransaction.codeVerifier');
    expect(html).toContain("new URL('https://id.vk.ru/authorize')");
    expect(html).toContain("data.state !== authorizationTransaction.state");
  });
});
