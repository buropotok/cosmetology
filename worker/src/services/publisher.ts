import type {Platform} from '../../../shared/contracts';
import type {Env} from '../types';
import {publishTelegram} from './telegram';
import {publishVK} from './vk';
import type {PostDocument} from '../../../shared/post-document';
import {renderTelegram} from '../../../shared/telegram-renderer';
import {renderVK} from '../../../shared/vk-renderer';

export async function publishPlatform(env: Env, platform: Platform, text: string, image?: File, document?: PostDocument, telegramChatId?: string) {
  if (platform === 'vk') {
    const result = await publishVK(env, document ? renderVK(document) : text);
    return {...result, ...(image ? {image_status: 'manual_required' as const} : {})};
  }
  if (!telegramChatId) throw new Error('Telegram destination missing');
  return publishTelegram(env, document ? renderTelegram(document) : text, image, telegramChatId);
}
