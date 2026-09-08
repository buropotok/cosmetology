import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const source=name=>readFileSync(resolve(root,'miniapp',name),'utf8');

describe('Before/After client persistence contract',()=>{
  it('keeps BA source images out of the shared Publisher draft image set',()=>{
    const controller=source('before-after-controller.js');
    const saveDraft=controller.match(/async function saveDraft\(snapshot\)\{(.+?)\n  async function saveAsset/s)?.[1]||'';
    expect(saveDraft).toContain("body.set('beforeAfterState'");
    expect(saveDraft).not.toContain("body.set('imagesChanged','1')");
    expect(saveDraft).not.toContain("body.append('images'");
    expect(controller).toContain("fetch('/api/miniapp/before-after/asset'");
    expect(controller).toContain("fetch('/api/miniapp/before-after/remove'");
    expect(controller).toContain("method:'POST'");
    expect(controller).toContain("fetch('/api/miniapp/before-after/swap'");
  });

  it('updates the local BA file cache only after durable asset operations succeed',()=>{
    const controller=source('before-after-controller.js'),drafts=source('drafts.js');
    expect(controller).toContain('setBeforeAfterImage?.(role,file)');
    expect(controller).toContain('setBeforeAfterImage?.(role,null)');
    expect(controller).toContain('swapBeforeAfterImages?.()');
    expect(drafts).toContain('function setBeforeAfterImage(role,file)');
    expect(drafts).toContain('function swapBeforeAfterImages()');
    expect(drafts).toContain('file=beforeAfterFiles.get(role)');
  });

  it('persists changed roles immediately and debounces state-only changes',()=>{
    const bridge=source('before-after-bridge.js');
    expect(bridge).toContain('persistSemanticChange');
    expect(bridge).toContain('saveAsset?.(role,next[role])');
    expect(bridge).toContain('removeAsset?.(role)');
    expect(bridge).toContain('swapAssets?.()');
    const scheduleStateSave=bridge.match(/function scheduleStateSave\(\)\{(.+?)\}\nfunction samePair/s)?.[1]||'';
    expect(scheduleStateSave).toContain('clearTimeout(saveTimer)');
    expect(scheduleStateSave).toContain('saveTimer=setTimeout(');
    expect(scheduleStateSave).toContain('persistDraft().catch(');
    expect(scheduleStateSave).toContain(',800)');
  });

  it('restores BA assets independently from Publisher images',()=>{
    const store=source('draft-store.js'),drafts=source('drafts.js');
    expect(store).toContain('draft.beforeAfterImages');
    expect(store).toContain('beforeAfterImages.push({role:item.role,file:new File');
    expect(drafts).toContain('current.beforeAfterState');
    expect(drafts).toContain('beforeAfterFiles.get(role)');
    expect(drafts).not.toContain('state.getSnapshot().images.slice(0,2)');
  });

  it('still does not persist BA state from Back or final Save',()=>{
    const bridge=source('before-after-bridge.js');
    const back=bridge.match(/if\(button\.id==='back'\)\{([^}]*)\}/)?.[1]||'';
    const save=bridge.match(/async function save\(\)\{(.+?)\}\nwindow\.addEventListener/s)?.[1]||'';
    expect(back).toContain('clearTimeout(saveTimer)');
    expect(back).not.toContain('persistDraft');
    expect(save).not.toContain('persistDraft');
  });
});
