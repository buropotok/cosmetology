import { describe, expect, it } from 'vitest';
import { AppError } from './types';

describe('AppError',()=>{
  it('recognizes an AppError-shaped value crossing a bundle boundary',()=>{
    const transported=Object.assign(new Error('Официальное изображение не найдено'),{
      name:'AppError',
      code:'AI_IMAGE_SEARCH_NOT_FOUND',
      status:404,
    });
    expect(transported instanceof AppError).toBe(true);
  });

  it('does not classify arbitrary errors as AppError',()=>{
    expect(new Error('boom') instanceof AppError).toBe(false);
    expect({name:'AppError',code:'BROKEN',status:200,message:'bad'} instanceof AppError).toBe(false);
  });
});
