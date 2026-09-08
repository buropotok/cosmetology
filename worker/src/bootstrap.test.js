// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeAll,describe,expect,it,vi} from 'vitest';

const repositoryRoot=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const miniappFile=name=>readFileSync(resolve(repositoryRoot,'miniapp',name),'utf8');

beforeAll(async()=>{await import('../../miniapp/diagnostics-fetch.js')});

describe('Mini App bootstrap',()=>{
  it('keeps the critical shell independent from feature runtimes',()=>{
    const html=miniappFile('index.html'),bootstrap=miniappFile('bootstrap.js');
    const shellModules=['telegram-gateway.js','app-router.js','navigation.js'];
    const featureModules=['app.js','account-state.js','onboarding-api.js','settings.js','composer-mockup.js','composer-state.js','draft-store.js','drafts.js','composer-actions.js','onboarding-flow.js','before-after-controller.js'];
    const scriptSources=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)].map(match=>match[1]);
    for(const name of shellModules)expect(bootstrap).toContain(`import('./${name}')`);
    for(const name of featureModules)expect(bootstrap).not.toContain(name);
    expect(scriptSources).toContain('/bootstrap.js');expect(scriptSources).toHaveLength(2);expect(scriptSources).toContain('https://telegram.org/js/telegram-web-app.js');expect(miniappFile('composer-mockup.js')).not.toContain("import('./navigation.js')");expect(miniappFile('drafts.js')).not.toContain("import('./navigation.js')");
    expect(bootstrap).toContain('webApp?.ready()');expect(bootstrap).toContain('webApp?.expand()');expect(miniappFile('app.js')).not.toContain('webApp?.ready()');
  });
  it('loads feature runtimes only from their owning lifecycle boundaries',()=>{const router=miniappFile('app-router.js'),navigation=miniappFile('navigation.js'),newPost=miniappFile('new-post-runtime.js');expect(router).toContain("import('./settings-runtime.js')");expect(navigation).toContain("import('./new-post-runtime.js')");expect(navigation).toContain("import('./before-after-controller.js')");expect(newPost).not.toContain('ai-mock-transfer.js');expect(newPost).not.toContain('before-after-controller.js')});
  it('lets navigation own only the Home settings button and uses the shared file asset',()=>{const navigation=miniappFile('navigation.js'),html=miniappFile('index.html');expect(navigation).toContain("background:transparent url('/assets/icons/settings.svg') center/24px 24px no-repeat");expect(navigation.match(/class="cosmo-flow-settings cosmo-settings-button"/g)).toHaveLength(1);expect(navigation).not.toContain("querySelector('#open-settings')");expect(html).not.toContain('id="open-settings"');expect(html).not.toContain('M19.14 12.94');expect(miniappFile('assets/icons/settings.svg')).toContain('M19.14 12.94')});
  it('loads the persisted onboarding action gate after composer actions',()=>{const runtime=miniappFile('new-post-runtime.js'),flow=miniappFile('onboarding-flow.js');expect(runtime.indexOf("'./composer-actions.js'")).toBeLessThan(runtime.indexOf("'./onboarding-flow.js'"));expect(flow).toContain("'/api/miniapp/onboarding-intent'");expect(flow).toContain("'/api/miniapp/onboarding-flow'");expect(flow).toContain('showPublishConfirmation');expect(flow).toContain('Диагностика onboarding flow')});
  it('cancels the pending action intent when edit onboarding is backed out',()=>{const flow=miniappFile('onboarding-flow.js'),controller=miniappFile('onboarding-controller.js');expect(controller).toContain("this.finish('cancelled','user_back')");expect(flow).toContain("result?.status==='cancelled'&&result?.reason==='user_back'");expect(flow).toContain("cancel().catch(error=>console.warn('Onboarding intent cancellation failed',error))")});
  it('prepares VK, persists publish intent, and routes VPN fallback through the managed bot',()=>{
    const app=miniappFile('app.js');
    expect(app).toContain("const images=(result?.draft?.images||[]).filter(image=>image?.url).slice(0,10)");
    expect(app).toContain('for(let index=0;index<images.length;index++)await downloadVkPhoto(images[index],index)');
    expect(app).not.toContain('draft?.images?.[0]');
    expect(app).toContain("createVkPublishIntent=()=>vkIntent('/api/miniapp/onboarding-intent',{action:'publish_vk'})");
    expect(app).toContain("title.textContent='VPN отключён?'");
    expect(app).toContain("vkButton('Да',true)");expect(app).toContain("vkButton('Нет',true)");expect(app).toContain("vkButton('Отмена')");
    expect(app).toContain("const {vkUrl}=await prepareVkLink('direct')");expect(app).toContain("const {managedBotUrl}=await prepareVkLink('managed_bot')");expect(app).toContain('webApp.openTelegramLink(managedBotUrl)');
    expect(app).toContain("body:JSON.stringify({delivery})");expect(app).toContain("delivery==='managed_bot'&&!result?.managedBotUrl");
    expect(app).not.toContain('resumeVkPublishIntent');expect(app).not.toContain("window.addEventListener('focus'");expect(app).not.toContain("document.addEventListener('visibilitychange'");
    expect(app).toContain('await completeVkPublishIntent();overlay.remove();webApp.openLink(vkUrl');expect(app).toContain('await completeVkPublishIntent();overlay.remove();webApp.openTelegramLink(managedBotUrl)');expect(app).toContain('await cancelVkPublishIntent();overlay.remove()');expect(app).not.toContain('post_id');
  });
  it('does not load the removed VK diagnostics harness',()=>{const app=miniappFile('app.js'),bootstrap=miniappFile('bootstrap.js');expect(app).not.toContain('vk-diagnostics.js');expect(bootstrap).not.toContain('vk-diagnostics.js');expect(app).not.toContain('CosmoVkDiagnostics')});
  it('does not replace global fetch when draft diagnostics are enabled',async()=>{const nativeFetch=vi.fn(async()=>new Response('{}',{status:200})),log=vi.fn(),now=vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(14);window.fetch=nativeFetch;const client=window.CosmoDiagnosticsFetch.create({fetchImpl:nativeFetch,log,now});const original=window.fetch;await client('/api/miniapp/draft',{method:'GET'});expect(window.fetch).toBe(original);expect(nativeFetch).toHaveBeenCalledOnce();expect(log).toHaveBeenNthCalledWith(1,'request',expect.objectContaining({method:'GET',url:'/api/miniapp/draft'}));expect(log).toHaveBeenNthCalledWith(2,'response',expect.objectContaining({status:200,durationMs:4}))});
  it('redacts draft text and describes files in diagnostics',async()=>{const log=vi.fn(),client=window.CosmoDiagnosticsFetch.create({fetchImpl:vi.fn(async()=>new Response('{}')),log,now:()=>0}),body=new FormData();body.set('text','private draft text');body.append('images',new File(['image'],'photo.jpg',{type:'image/jpeg'}));await client('/api/miniapp/draft',{method:'POST',body});const details=log.mock.calls[0][1];expect(details.body.text).toBe('[text 18 chars]');expect(details.body.images).toEqual(['[File photo.jpg 5b]']);expect(JSON.stringify(details)).not.toContain('private draft text')});
});
