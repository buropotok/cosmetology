import type {Env} from '../types';import {AppError} from '../types';import {planTelegramPublication,type TelegramRender} from '../../../shared/telegram-renderer';
function redactTelegramCredential(value:string,token:string,url:string){return value.split(url).join('[REDACTED]').split(token).join('[REDACTED]')}
async function callWithToken(token:string,method:string,body?:FormData){
  const url=`https://api.telegram.org/bot${token}/${method}`;
  const init:RequestInit={method:'POST'};
  if(body!==undefined)init.body=body;
  let response:Response;
  try{response=await fetch(url,init)}catch(error){
    const errorMessage=error instanceof Error?error.message:String(error);
    console.error({event:'telegram_bot_api_transport_error',method,errorName:error instanceof Error?error.name:null,errorMessage:redactTelegramCredential(errorMessage,token,url)});
    throw new AppError('TELEGRAM_ERROR','Не удалось выполнить запрос к Telegram',502)
  }
  const responseText=await response.text();
  let json:any;
  try{json=JSON.parse(responseText)}catch{
    console.error({event:'telegram_bot_api_response_parse_error',method,httpStatus:response.status,contentType:response.headers.get('content-type'),responseLength:responseText.length});
    throw new AppError('TELEGRAM_ERROR','Telegram вернул некорректный ответ',502)
  }
  if(!response.ok||!json?.ok){
    const description=typeof json?.description==='string'?redactTelegramCredential(json.description,token,url):null;
    console.error({event:'telegram_managed_bot_api_error',method,errorCode:json?.error_code??null,description});
    throw new AppError('TELEGRAM_ERROR',`Telegram отклонил запрос${json?.error_code?` (код ${json.error_code})`:''}`,502)
  }
  return json.result
}
async function call(env:Env,method:string,body?:FormData){return callWithToken(env.TELEGRAM_BOT_TOKEN,method,body)}
function url(chat:string,id:number){return chat.startsWith('@')?`https://t.me/${chat.slice(1)}/${id}`:undefined}
export async function sendTelegramText(env:Env,chatId:string,text:string){const body=new FormData();body.set('chat_id',chatId);body.set('text',text);return call(env,'sendMessage',body)}

export async function sendTelegramMiniAppButton(env:Env,chatId:string,url:string){const body=new FormData();body.set('chat_id',chatId);body.set('text','Откройте приложение, чтобы создать публикацию.');body.set('reply_markup',JSON.stringify({inline_keyboard:[[{text:'Открыть приложение',web_app:{url}}]]}));return call(env,'sendMessage',body)}
export async function getTelegramChatMember(env:Env,chatId:string,userId:string){const body=new FormData();body.set('chat_id',chatId);body.set('user_id',userId);return call(env,'getChatMember',body) as Promise<{status:string}>}
export async function getTelegramBotMe(env:Env){return call(env,'getMe') as Promise<{id:number;username?:string;first_name:string;can_manage_bots?:boolean}>}
export async function getManagedTelegramBotToken(env:Env,managedBotId:string){const body=new FormData();body.set('user_id',managedBotId);return call(env,'getManagedBotToken',body) as Promise<string>}
export async function getTelegramBotMeWithToken(token:string){return callWithToken(token,'getMe') as Promise<{id:number;username?:string;first_name:string}>}
export async function sendTelegramManagedBotRequest(env:Env,chatId:string,requestId:number,suggestedName:string,suggestedUsername:string){const body=new FormData();body.set('chat_id',chatId);body.set('text','Создайте персонального Telegram-бота для Cosmo Sofa.');body.set('reply_markup',JSON.stringify({keyboard:[[{text:'Создать персонального бота',request_managed_bot:{request_id:requestId,suggested_name:suggestedName,suggested_username:suggestedUsername}}]],resize_keyboard:true,one_time_keyboard:true}));return call(env,'sendMessage',body)}
export async function publishTelegram(env:Env,rendered:TelegramRender|string,image:File|undefined,chatId:string){const rich=typeof rendered!=='string',value=rich?rendered as TelegramRender:{html:rendered as string,plainText:rendered as string,blocks:[],buttons:[]},keyboard=value.buttons?.length?JSON.stringify({inline_keyboard:value.buttons.map(button=>[{text:button.text,url:button.url}])}):undefined,plan=planTelegramPublication(value,!!image),{html,plainText}=value;if(plainText.length>4096)throw new AppError('TELEGRAM_TEXT_TOO_LONG','Telegram: текст не должен превышать 4096 символов',400);let first;if(image){const f=new FormData();f.set('chat_id',chatId);f.set('photo',image,'image');if(plan.type==='photo_with_caption'){f.set('caption',html);if(rich)f.set('parse_mode','HTML');if(keyboard)f.set('reply_markup',keyboard)}first=await call(env,'sendPhoto',f);if(plan.type==='photo_then_text'){const t=new FormData();t.set('chat_id',chatId);t.set('text',html);if(rich)t.set('parse_mode','HTML');if(keyboard)t.set('reply_markup',keyboard);await call(env,'sendMessage',t)}}else{const f=new FormData();f.set('chat_id',chatId);f.set('text',html);if(rich)f.set('parse_mode','HTML');if(keyboard)f.set('reply_markup',keyboard);first=await call(env,'sendMessage',f)}return {external_id:String(first.message_id),url:url(chatId,first.message_id),delivery_mode:plan.type}}
