import type {Platform} from '../../../shared/contracts';
import type {Env} from '../types';
import {publishTelegramWithToken} from './telegram';
import {publishVK} from './vk';
import type {PostDocument} from '../../../shared/post-document';
import {renderTelegram} from '../../../shared/telegram-renderer';
import {renderVK} from '../../../shared/vk-renderer';
import type {ManagedPublicationTarget} from './managed-bot-publication';
import {sanitizePostDocumentLinks} from './link-validator';

export async function publishPlatform(env:Env,platform:Platform,text:string,image?:File,document?:PostDocument,telegramTarget?:ManagedPublicationTarget){
  const safeDocument=document?await sanitizePostDocumentLinks(document):undefined;
  if(platform==='vk'){
    const result=await publishVK(env,safeDocument?renderVK(safeDocument):text);
    return{...result,...(image?{image_status:'manual_required' as const}:{})};
  }
  if(!telegramTarget)throw new Error('Telegram managed bot destination missing');
  return publishTelegramWithToken(telegramTarget.token,safeDocument?renderTelegram(safeDocument):text,image,telegramTarget.chatId);
}
