// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeAll,describe,expect,it,vi} from 'vitest';

const repositoryRoot=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const miniappFile=name=>readFileSync(resolve(repositoryRoot,'miniapp',name),'utf8');

beforeAll(async()=>{await import('../../miniapp/diagnostics-fetch.js')});

describe('Mini App bootstrap',()=>{
  it('is the only loader for stateful composer modules',()=>{
    const html=miniappFile('index.html'),bootstrap=miniappFile('bootstrap.js');
    for(const name of ['drafts.js','composer-screen.js','composer-image-manager.js','build-id.js']){
      expect(html.match(new RegExp(name.replace('.','\\.'),'g'))||[]).toHaveLength(0);
      expect(bootstrap.match(new RegExp(name.replace('.','\\.'),'g'))||[]).toHaveLength(1);
    }
    expect(html.match(/bootstrap\.js/g)).toHaveLength(1);
    expect(miniappFile('composer-mockup.js')).not.toContain("import('/navigation.js')");
    expect(miniappFile('drafts.js')).not.toContain("import('/navigation.js')");
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
