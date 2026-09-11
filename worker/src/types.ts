export interface Env{DB:D1Database;IMAGES:R2Bucket;LOGS:R2Bucket;ASSETS:Fetcher;VK_ACCESS_TOKEN:string;VK_GROUP_ID:string;VK_ID_SERVICE_TOKEN:string;TELEGRAM_BOT_TOKEN:string;TELEGRAM_WEBHOOK_SECRET:string;PAIRING_CODE_SECRET:string;MANAGED_BOT_ENCRYPTION_KEY:string;GOOGLE_OAUTH_CLIENT_ID:string;ALLOWED_EXTENSION_ORIGIN:string;GEMINI_API_KEY:string;AI_TEXT_MODEL?:string;AI_IMAGE_MODEL?:string;ADMIN_TOKEN?:string;MINIAPP_URL?:string;YANDEX_VK_BASE_URL?:string;YANDEX_REPLICA_TOKEN?:string;R2_S3_ENDPOINT?:string;R2_ACCESS_KEY_ID?:string;R2_SECRET_ACCESS_KEY?:string}
export class AppError extends Error{
  constructor(public code:string,message:string,public status=500){super(message);this.name='AppError'}
  static [Symbol.hasInstance](value:unknown){
    if(!value||typeof value!=='object')return false;
    const error=value as {name?:unknown;code?:unknown;status?:unknown;message?:unknown};
    return error.name==='AppError'&&typeof error.code==='string'&&typeof error.message==='string'&&typeof error.status==='number'&&Number.isInteger(error.status)&&error.status>=400&&error.status<=599;
  }
}
