import type {Platform} from '../../../shared/contracts';
import type {Env} from '../types';
import {publishTelegramWithToken} from './telegram';
import {publishVK} from './vk';
import type {PostDocument} from '../../../shared/post-document';
import {renderTelegram} from '../../../shared/telegram-renderer';
import {renderVK} from '../../../shared/vk-renderer';
import type {ManagedPublicationTarget} from './managed-bot-publication';

export async function publishPlatform(env:Env,platform:Platform,text:string,image?:File,document?:PostDocument,telegramTarget?:ManagedPublicationTarget){
  if(platform==='vk'){
    const result=await publishVK(env,document?renderVK(document):text);
    return{...result,...(image?{image_status:'manual_required' as const}:{})};
  }
  if(!telegramTarget)throw new Error('Telegram managed bot destination missing');
  return publishTelegramWithToken(telegramTarget.token,document?renderTelegram(document):text,image,telegramTarget.chatId);
}
