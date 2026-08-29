import {AppError,type Env} from '../types';
import {decryptManagedBotToken} from './managed-bot-crypto';

export type ManagedPublicationTarget={token:string;chatId:string;botId:string};
type Row={telegram_bot_id:string;telegram_chat_id:string;token_ciphertext:string;token_iv:string;token_key_version:number};

export async function getManagedPublicationTarget(env:Env,userId:string):Promise<ManagedPublicationTarget>{
  const row=await env.DB.prepare(`SELECT mb.telegram_bot_id,d.telegram_chat_id,mb.token_ciphertext,mb.token_iv,mb.token_key_version
    FROM telegram_managed_bots mb
    JOIN telegram_managed_bot_destinations d ON d.telegram_bot_id=mb.telegram_bot_id AND d.user_id=mb.user_id AND d.status='active'
    JOIN telegram_managed_bot_webhooks wh ON wh.telegram_bot_id=mb.telegram_bot_id AND wh.status='active'
    WHERE mb.user_id=? AND mb.status='active' AND mb.token_ciphertext IS NOT NULL AND mb.token_iv IS NOT NULL
    ORDER BY mb.updated_at DESC LIMIT 1`).bind(userId).first<Row>();
  if(!row)throw new AppError('MANAGED_TELEGRAM_NOT_CONNECTED','Подключите персонального Telegram-бота и группу',409);
  const token=await decryptManagedBotToken(row.telegram_bot_id,{ciphertext:row.token_ciphertext,iv:row.token_iv,keyVersion:row.token_key_version},env);
  return{token,chatId:row.telegram_chat_id,botId:row.telegram_bot_id};
}
