import { AppError, type Env } from '../types';
import { MINIAPP_IMAGE_MAX_BYTES } from './miniapp';

export function validateMediaImage(image:File){
  if(image.size<=0)throw new AppError('INVALID_IMAGE','Изображение обязательно',400);
  if(!image.type.toLowerCase().startsWith('image/'))throw new AppError('INVALID_IMAGE_TYPE','Можно выбрать только изображение',400);
  if(image.size>MINIAPP_IMAGE_MAX_BYTES)throw new AppError('IMAGE_TOO_LARGE','Изображение должно быть не больше 10 МБ',400);
}
