// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeAll,describe,expect,it,vi} from 'vitest';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const source=name=>readFileSync(resolve(root,'miniapp',name),'utf8');
beforeAll(()=>window.eval(source('composer-actions.js')));

const response=(ok=true,result={ok:true})=>({ok,json:async()=>result});
function setup({ok=true}={}){
  const order=[],flush=vi.fn(async reason=>{order.push(`flush:${reason}`)}),fetchImpl=vi.fn(async url=>{order.push(`fetch:${url}`);return response(ok)}),onTelegramPublished=vi.fn(async()=>{order.push('telegram-success')});
  const actions=window.CosmoComposerActionsFactory.create({getDraftStore:()=>({flush}),fetchImpl,onTelegramPublished});
  return {actions,order,flush,fetchImpl,onTelegramPublished};
}

describe('explicit composer actions',()=>{
  it('flushes before Preview request',async()=>{const {actions,order}=setup();await actions.preview({method:'POST'});expect(order).toEqual(['flush:preview','fetch:/api/miniapp/preview'])});
  it('flushes before Telegram Publish request',async()=>{const {actions,order}=setup();await actions.publishTelegram({method:'POST'});expect(order.slice(0,2)).toEqual(['flush:telegram-publish','fetch:/api/miniapp/publish'])});
  it('flushes before the VK operation',async()=>{const {actions,order}=setup();await actions.publishVk(async()=>order.push('vk-operation'));expect(order).toEqual(['flush:vk-publish','vk-operation'])});
  it('runs Telegram post-success behavior explicitly',async()=>{const {actions,onTelegramPublished,order}=setup();await actions.publishTelegram({method:'POST'});expect(onTelegramPublished).toHaveBeenCalledOnce();expect(order).toEqual(['flush:telegram-publish','fetch:/api/miniapp/publish','telegram-success'])});
  it('does not run success cleanup after failed Publish',async()=>{const {actions,onTelegramPublished}=setup({ok:false});await actions.publishTelegram({method:'POST'});expect(onTelegramPublished).not.toHaveBeenCalled()});
  it('removes fetch interception from VK return confirmation',()=>{const code=source('vk-return-confirmation.js');expect(code).not.toMatch(/window\.fetch\s*=/);expect(code).toContain('CosmoVkReturnConfirmation');expect(code).toContain('CosmoSofaDraft?.clear')});
  it('loads the action module exactly once through bootstrap',()=>{const bootstrap=source('bootstrap.js');expect(bootstrap.match(/composer-actions\.js/g)).toHaveLength(1);expect(bootstrap.indexOf('drafts.js')).toBeLessThan(bootstrap.indexOf('composer-actions.js'))});
});
