import type {PublishResponse,PostsResponse,PostSummary,Platform} from '../../../shared/contracts';import type {PostDocument} from '../../../shared/post-document';import {ApiError,authenticatedFetch} from './auth';
async function request<T>(path:string,init?:RequestInit,interactive=false){const r=await authenticatedFetch(path,init,interactive),body=await r.json().catch(()=>({error:{message:`HTTP ${r.status}`,code:'HTTP_ERROR'}})) as any;if(!r.ok)throw new ApiError(body.error?.code??'HTTP_ERROR',body.error?.message??`HTTP ${r.status}`,r.status);return body as T}
export async function publish(input:{text:string;postDocument:PostDocument;targets:Platform[];metadata:Record<string,string>;postId?:number;image?:Blob;idempotencyKey:string}){const form=new FormData();form.set('payload',JSON.stringify({text:input.text,post_document:input.postDocument,targets:input.targets,metadata:input.metadata,post_id:input.postId,idempotency_key:input.idempotencyKey}));if(input.image)form.set('image',input.image,'post-image');return request<PublishResponse>('/api/publish',{method:'POST',body:form})}
export const posts=(search='')=>request<PostsResponse>(`/api/posts?page=1&page_size=30&search=${encodeURIComponent(search)}`);export const post=(id:number)=>request<PostSummary>(`/api/posts/${id}`);
export interface TelegramConnection{connected:boolean;chatTitle?:string;chatType?:'group'|'supergroup'}
export interface TelegramPairing{pairingId:string;code:string;command:string;expiresAt:string}
export const telegramConnection=()=>request<TelegramConnection>('/api/telegram/connection');
export const createTelegramPairing=()=>request<TelegramPairing>('/api/telegram/pairing',{method:'POST'},true);
export const disconnectTelegram=()=>request<TelegramConnection>('/api/telegram/connection',{method:'DELETE'},true);

export async function protectedImage(imageUrl:string){const url=new URL(imageUrl);const response=await authenticatedFetch(`${url.pathname}${url.search}`);if(!response.ok)throw new ApiError('IMAGE_UNAVAILABLE','Изображение недоступно',response.status);return response.blob()}
