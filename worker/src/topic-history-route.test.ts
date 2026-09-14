import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('public topic history route ownership', () => {
  it('routes the public per-user TXT path directly to topic history storage', async () => {
    const source = await readFile(new URL('./entry.ts', import.meta.url), 'utf8');
    expect(source).toContain("url.pathname.match(/^\\/api\\/ai\\/topic-history\\/([^/]+)\\.txt$/)");
    expect(source).toContain("if(req.method==='GET'&&topicHistory)return getTopicHistory(env,topicHistory[1])");
  });
});
