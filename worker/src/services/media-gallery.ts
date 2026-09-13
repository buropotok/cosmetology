import { AppError, type Env } from '../types';
import { requireTelegramMiniAppSession } from './telegram-miniapp-auth';
import { resolveOrCreateTelegramIdentity } from './telegram-identity';
import { listPermanentMediaAssets } from './media-assets';

async function accountFor(request:Request,env:Env){const validated=await requireTelegramMiniAppSession(request,env);return resolveOrCreateTelegramIdentity(env,String(validated.user.id));}
