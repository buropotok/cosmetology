import type { Env } from '../types';
import { requireTelegramMiniAppSession } from './telegram-miniapp-auth';
import { resolveOrCreateTelegramIdentity } from './telegram-identity';
import { listPermanentMediaAssets } from './media-assets';

async function accountFor(request:Request,env:Env){const validated=await requireTelegramMiniAppSession(request,env);return resolveOrCreateTelegramIdentity(env,String(validated.user.id));}

export async function getMediaGallery(request:Request,env:Env){
  const account=await accountFor(request,env);const url=new URL(request.url);const requested=Number(url.searchParams.get('limit')||100);
  const assets=await listPermanentMediaAssets(env,account.userId,requested);
  return {assets:assets.map(asset=>({...asset,url:`/api/miniapp/draft/image/${encodeURIComponent(asset.key)}`}))};
}
