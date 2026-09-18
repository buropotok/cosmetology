import { describe, expect, it } from 'vitest';
import { adminHtml, listAdminUsers } from './admin';

describe('admin Telegram user profile', () => {
  it('loads Telegram profile fields for admin users', async () => {
    const queries: string[] = [];
    const DB = {
      prepare(sql: string) {
        queries.push(sql);
        return { all: async () => ({ results: [] }) };
      },
    };
    const request = new Request('https://example.com/api/admin/users', { headers: { authorization: 'Bearer test-admin' } });

    await listAdminUsers(request, { DB, ADMIN_TOKEN: 'test-admin' } as any);

    expect(queries[0]).toContain('ti.first_name');
    expect(queries[0]).toContain('ti.last_name');
    expect(queries[0]).toContain('ti.username');
    expect(queries[0]).toContain('ti.photo_url');
  });

  it('renders the Telegram name and avatar in the user header while retaining IDs', () => {
    const html = adminHtml();
    expect(html).toContain('u.telegram_first_name');
    expect(html).toContain('u.telegram_last_name');
    expect(html).toContain('u.telegram_photo_url');
    expect(html).toContain('User ID: ');
    expect(html).toContain('Telegram user: ');
  });
});
