// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeAll,describe,expect,it,vi} from 'vitest';

const repositoryRoot=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const miniappFile=name=>readFileSync(resolve(repositoryRoot,'miniapp',name),'utf8');

beforeAll(async()=>{await import('../../miniapp/diagnostics-fetch.js')});

describe('Mini App bootstrap',()=>{
  it('is the only loader for first-party runtime modules',()=>{
    const html=miniappFile('index.html'),bootstrap=miniappFile('bootstrap.js');
    const runtimeModules=[
      'telegram-gateway.js','app-router.js','app.js','account-state.js',
      'onboarding-api.js','onboarding-controller.js','onboarding-view.js','onboarding-router.js',
      'settings.js','composer-mockup.js','vk-diagnostics.js','navigation.js','composer-screen.js',
      'composer-editor-stability.js','composer-image-manager.js','before-after-bridge.js',
      'diagnostics-fetch.js','composer-state.js','draft-store.js','drafts.js','composer-actions.js',
      'ai-mock-transfer.js','build-id.js','vk-return-confirmation.js'
    ];
    const scriptSources=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)].map(match=>match[1]);
    for(const name of runtimeModules){
      expect(scriptSources).not.toContain(`/${name}`);
      const importLiteral=`'/${name}'`;
      expect(bootstrap.split(importLiteral)).toHaveLength(2);
    }
    expect(scriptSources).toContain('/bootstrap.js');
    expect(scriptSources).toHaveLength(2);
    expect(scriptSources).toContain('https://telegram.org/js/telegram-web-app.js');
    expect(miniappFile('composer-mockup.js')).not.toContain("import('/navigation.js')");
    expect(miniappFile('drafts.js')).not.toContain("import('/navigation.js')");
  });

  it('declares explicit startup phases in dependency order',()=>{
    const bootstrap=miniappFile('bootstrap.js');
    const phases=['loadPlatform','loadOnboardingAndSettings','loadAppShell','loadComposerRuntime','loadRuntimeIntegrations'];
    for(const phase of phases)expect(bootstrap).toContain(`async function ${phase}()`);
    const start=bootstrap.slice(bootstrap.indexOf('async function start()'));
    for(let i=1;i<phases.length;i++)expect(start.indexOf(`await ${phases[i-1]}()`)).toBeLessThan(start.indexOf(`await ${phases[i]}()`));
  });

  it('preserves legacy first-party startup order inside bootstrap',()=>{
    const bootstrap=miniappFile('bootstrap.js');
    const ordered=[
      'telegram-gateway.js','app-router.js','app.js','account-state.js',
      'onboarding-api.js','onboarding-controller.js','onboarding-view.js','onboarding-router.js',
      'settings.js','composer-mockup.js','vk-diagnostics.js','navigation.js'
    ];
    for(let i=1;i<ordered.length;i++)expect(bootstrap.indexOf(ordered[i-1])).toBeLessThan(bootstrap.indexOf(ordered[i]));
  });

  it('loads VK diagnostics once from bootstrap before dependent runtime code',()=>{
    const app=miniappFile('app.js'),bootstrap=miniappFile('bootstrap.js');
    expect(app).not.toContain('vk-diagnostics.js');
    expect(app).not.toMatch(/createElement\(['"]script['"]\)/);
    expect(bootstrap.match(/vk-diagnostics\.js/g)).toHaveLength(1);
    expect(bootstrap.indexOf('vk-diagnostics.js')).toBeLessThan(bootstrap.indexOf('navigation.js'));
  });

  it('does not replace global fetch when draft diagnostics are enabled',async()=>{
    const nativeFetch=vi.fn(async()=>new Response('{}',{status:200})),log=vi.fn(),now=vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(14);
    window.fetch=nativeFetch;const client=window.CosmoDiagnosticsFetch.create({fetchImpl:nativeFetch,log,now});const original=window.fetch;
    await client('/api/miniapp/draft',{method:'GET'});
    expect(window.fetch).toBe(original);expect(nativeFetch).toHaveBeenCalledOnce();expect(log).toHaveBeenNthCalledWith(1,'request',expect.objectContaining({method:'GET',url:'/api/miniapp/draft'}));expect(log).toHaveBeenNthCalledWith(2,'response',expect.objectContaining({status:200,durationMs:4}));
  });

  it('redacts draft text and describes files in diagnostics',async()=>{
    const log=vi.fn(),client=window.CosmoDiagnosticsFetch.create({fetchImpl:vi.fn(async()=>new Response('{}')),log,now:()=>0}),body=new FormData();body.set('text','private draft text');body.append('images',new File(['image'],'photo.jpg',{type:'image/jpeg'}));
    await client('/api/miniapp/draft',{method:'POST',body});const details=log.mock.calls[0][1];expect(details.body.text).toBe('[text 18 chars]');expect(details.body.images).toEqual(['[File photo.jpg 5b]']);expect(JSON.stringify(details)).not.toContain('private draft text');
  });
});
