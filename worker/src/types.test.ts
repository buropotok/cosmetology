import { describe, expect, it } from 'vitest';
import { AppError, isAppError } from './types';

describe('AppError',()=>{
  it('keeps Error and AppError identity',()=>{
    const error=new AppError('AI_IMAGE_SEARCH_NOT_FOUND','Официальное изображение не найдено',404);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(isAppError(error)).toBe(true);
  });

  it('recognizes a serialized AppError-shaped value without accepting arbitrary errors',()=>{
    expect(isAppError({name:'AppError',code:'AI_IMAGE_SEARCH_NOT_FOUND',message:'Официальное изображение не найдено',status:404})).toBe(true);
    expect(isAppError(new Error('boom'))).toBe(false);
    expect(isAppError({name:'AppError',code:'X',message:'bad',status:200})).toBe(false);
  });
});
