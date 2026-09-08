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
    expect(controller).toContain("fetch('/api/miniapp/before-after/swap'");
  });

  it('uses the dedicated Telegram-authenticated remove endpoint',()=>{
    const controller=source('before-after-controller.js');
    const removeAsset=controller.match(/async function removeAsset\(role\)\{(.+?)\n  async function swapAssets/s)?.[1]||'';
    expect(removeAsset).toContain("fetch('/api/miniapp/before-after/remove'");
    expect(removeAsset).toContain("method:'POST'");
    expect(removeAsset).toContain('authHeaders()');
    expect(removeAsset).not.toContain("method:'DELETE'");
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

  it('appends the final BA composite through Composer and lets draft persistence save the full image set',()=>{
    const controller=source('before-after-controller.js');
    const applyImageFile=controller.match(/function applyImageFile\(file\)\{(.+?)\n  \}\n  const nextPaint/s)?.[1]||'';
    const save=controller.match(/async function save\(blob,name=.+?\)\{(.+?)\n  \}\n  window\.addEventListener/s)?.[1]||'';
    expect(applyImageFile).toContain('manager?.addFiles');
    expect(applyImageFile).toContain('manager.addFiles([file])');
    expect(applyImageFile).not.toContain('replaceFiles');
    expect(save).toContain("draft.flush('before-after-save')");
    expect(save).not.toContain("fetch('/api/miniapp/draft'");
    expect(controller).not.toContain('function persistResult');
    expect(controller).not.toContain('function draftBody');
  });

  it('rejects BA append when Composer already owns ten photos',()=>{
    const controller=source('before-after-controller.js');
    expect(controller).toContain("if((manager.getFiles?.().length||0)>=10)return false");
    expect(controller).toContain('В редакторе уже 10 фотографий. Удалите одну и повторите сохранение.');
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
    expect(drafts).toContain('current.beforeAfterImages');
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
