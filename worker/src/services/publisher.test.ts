import {afterEach, describe, expect, it, vi} from 'vitest';
import type {Env} from '../types';

vi.mock('./vk', () => ({publishVK: vi.fn(async () => ({external_id: 'vk-id'}))}));
vi.mock('./telegram', () => ({publishTelegram: vi.fn(async () => ({external_id: 'tg-id'}))}));

import {publishPlatform} from './publisher';
import {publishTelegram} from './telegram';
import {publishVK} from './vk';

const env = {} as Env;

afterEach(() => vi.clearAllMocks());

describe('platform image policy', () => {
  it('publishes VK text only and marks an image for manual attachment', async () => {
    const image = new File(['image'], 'post.png', {type: 'image/png'});
    const result = await publishPlatform(env, 'vk', 'Post', image);

    expect(publishVK).toHaveBeenCalledWith(env, 'Post');
    expect(result).toMatchObject({external_id: 'vk-id', image_status: 'manual_required'});
  });

  it('keeps a normal VK result when no image was selected', async () => {
    const result = await publishPlatform(env, 'vk', 'Post');
    expect(result).toEqual({external_id: 'vk-id'});
  });

  it('continues sending Telegram the selected image and publication text', async () => {
    const image = new File(['image'], 'post.png', {type: 'image/png'});
    await publishPlatform(env, 'telegram', 'Full illustration post', image, undefined, '@group');
    await publishPlatform(env, 'telegram', 'Infographic title', image, undefined, '@group');
    await publishPlatform(env, 'telegram', 'Text-only post', undefined, undefined, '@group');
    expect(publishTelegram).toHaveBeenNthCalledWith(1, env, 'Full illustration post', image, '@group');
    expect(publishTelegram).toHaveBeenCalledWith(env, 'Infographic title', image, '@group');
    expect(publishTelegram).toHaveBeenLastCalledWith(env, 'Text-only post', undefined, '@group');
  });
});
