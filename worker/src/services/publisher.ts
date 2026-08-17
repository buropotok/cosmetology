import type {Platform} from '../../../shared/contracts';
import type {Env} from '../types';
import {publishTelegram} from './telegram';
import {publishVK} from './vk';

export async function publishPlatform(env: Env, platform: Platform, text: string, image?: File) {
  if (platform === 'vk') {
    const result = await publishVK(env, text);
    return {...result, ...(image ? {image_status: 'manual_required' as const} : {})};
  }
  return publishTelegram(env, text, image);
}
