export interface Env{DB:D1Database;IMAGES:R2Bucket;VK_ACCESS_TOKEN:string;VK_GROUP_ID:string;TELEGRAM_BOT_TOKEN:string;TELEGRAM_CHAT_ID:string;PUBLISH_API_TOKEN:string;ALLOWED_EXTENSION_ORIGIN:string}
export class AppError extends Error{constructor(public code:string,message:string,public status=500){super(message)}}
