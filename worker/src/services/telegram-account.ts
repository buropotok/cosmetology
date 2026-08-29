import {AppError,type Env} from '../types';
import {sendTelegramMiniAppButton} from './telegram';
import {handleManagedBotUpdate} from './telegram-managed-bots';

export async function telegramWebhook(request:Request,env:Env){
  if(request.headers.get('x-telegram-bot-api-secret-token')!==env.TELEGRAM_WEBHOOK_SECRET)throw new AppError('WEBHOOK_UNAUTHORIZED','Forbidden',403);
  const update=await request.json<any>().catch(()=>null);
  const message=update?.message,rawText=typeof message?.text==='string'?message.text:'';
  console.log({event:'telegram_webhook_update',updateId:update?.update_id??null,chatId:message?.chat?.id!=null?String(message.chat.id):null,chatType:message?.chat?.type??null,fromId:message?.from?.id!=null?String(message.from.id):null,text:rawText||null});
  if(await handleManagedBotUpdate(update,env))return{ok:true};
  if(/^\/start(?:@\w+)?(?:\s|$)/i.test(rawText)){
    const chatId=message?.chat?.id!=null?String(message.chat.id):null,url=env.MINIAPP_URL?.trim();
    if(chatId&&url){await sendTelegramMiniAppButton(env,chatId,url);console.log({event:'telegram_start_sent',chatId})}
  }
  return{ok:true};
}
