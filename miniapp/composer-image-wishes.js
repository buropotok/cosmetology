export const IMAGE_WISHES_PREFIX='Учитывай пожелания пользователя в первую очередь:';

export function normalizeImageWishes(value){
  return typeof value==='string'?value.trim():'';
}

export function imageWishesAction(value){
  return normalizeImageWishes(value)?'Продолжить':'Пропустить';
}

export function combineImageGenerationText(postText,wishes){
  const normalized=normalizeImageWishes(wishes);
  return normalized?`${postText}\n\n${IMAGE_WISHES_PREFIX} ${normalized}`:postText;
}
