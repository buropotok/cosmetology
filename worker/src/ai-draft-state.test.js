// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeAll,describe,expect,it,vi} from 'vitest';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const source=name=>readFileSync(resolve(root,'miniapp',name),'utf8');
beforeAll(()=>window.eval(source('draft-store.js')));

function observable(initial){
  let snapshot={...initial},version=0;const listeners=new Set();
  return {getSnapshot:()=>snapshot,getVersion:()=>version,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},restore(value){snapshot={...snapshot,...value};version++},reset(){snapshot={...initial};version++},change(value){snapshot={...snapshot,...value};version++;listeners.forEach(fn=>fn({reason:'test',fields:[],snapshot}))}};
}

describe('AI draft state',()=>{
  it('serializes and restores wizard state through the existing draft store',async()=>{
    const state=observable({content:'',plainText:'',images:[],activePhotoIndex:0,platform:'telegram'});
    const ai=observable({screen:'ai',preset:'Новости',prompt:'тема',response:'',discovery:{schemaVersion:1,ideas:[{id:'idea_1',title:'A',text:'B'}]}});
    const fetchImpl=vi.fn().mockResolvedValueOnce({ok:true,status:200}).mockResolvedValueOnce({ok:true,json:async()=>({draft:{text:'',platform:'telegram',activePhotoIndex:0,screen:'ai',aiState:{preset:'Мифы',prompt:'восстановлено',response:'ответ',discovery:null},images:[]}})});
    const store=window.CosmoDraftStoreFactory.create({state,auxState:ai,fetchImpl});
    ai.change({prompt:'новая тема'});await store.flush();
    const body=fetchImpl.mock.calls[0][1].body;
    expect(body.get('screen')).toBe('ai');expect(JSON.parse(body.get('aiState')).prompt).toBe('новая тема');
    await store.load();expect(ai.getSnapshot()).toMatchObject({screen:'ai',preset:'Мифы',prompt:'восстановлено',response:'ответ'});store.dispose();
  });

  it('keeps AI state in the unified miniapp_drafts record',()=>{
    const migration=readFileSync(resolve(root,'worker/migrations/0017_ai_draft_state.sql'),'utf8');
    const service=readFileSync(resolve(root,'worker/src/services/miniapp-drafts.ts'),'utf8');
    expect(migration).toContain('ALTER TABLE miniapp_drafts ADD COLUMN screen');
    expect(migration).toContain('ALTER TABLE miniapp_drafts ADD COLUMN ai_state');
    expect(service).toContain('screen,ai_state');
    expect(service).not.toContain('miniapp_ai_drafts');
  });

  it('uses one stateful control panel for discovery and ready-post actions',()=>{
    const wizard=source('publish-ai-wizard.js');
    expect(wizard).toContain('data-ai-control-panel');
    expect(wizard).toContain("renderControlPanel('discovery',discovery)");
    expect(wizard).toContain("controlsState:'ready-post'");
    expect(wizard).toContain("['Короче','shorter']");
    expect(wizard).toContain("['Другое','another']");
    expect(wizard).toContain('Сделай предыдущий готовый пост короче, сохранив ключевые факты и смысл.');
    expect(wizard).toContain('Подготовь другой полный вариант этого поста с другой подачей, сохранив фактическую точность.');
  });
});
