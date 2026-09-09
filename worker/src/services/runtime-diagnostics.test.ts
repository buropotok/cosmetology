import {describe,expect,it,vi} from 'vitest';
import type {Env} from '../types';
import {normalizeRuntimeDiagnosticSnapshot,renderRuntimeDiagnosticLog,runtimeDiagnosticKey,storeRuntimeDiagnosticSnapshot} from './runtime-diagnostics';

const rawSnapshot={
  schemaVersion:1,
  sessionNumber:'1788950000123',
  sessionStartedAt:'2026-09-09T11:58:00.000Z',
  deviceType:'ios',
  telegramPlatform:'ios',
  telegramVersion:'12.0',
  buildId:'BUILD-TEST',
  userAgent:'Telegram iOS WebView',
  language:'ru-RU',
  viewport:{width:390,height:844,devicePixelRatio:3},
  events:[
    {seq:1,time:'2026-09-09T11:58:01.000Z',event:'module_load',stage:'new-post.preparation',module:'composer-editor-runtime',status:'loading'},
    {seq:2,time:'2026-09-09T11:58:01.240Z',event:'module_load',stage:'new-post.preparation',module:'composer-editor-runtime',status:'loaded',durationMs:240},
    {seq:3,time:'2026-09-09T11:58:01.300Z',event:'module_load',stage:'new-post.editor-runtime',module:'composer-tiptap-draft-bridge',status:'failed',durationMs:31,error:'TypeError: bridge failed token=supersecret'}
  ],
  initData:'must-not-be-persisted'
};

describe('runtime diagnostic artifacts',()=>{
  it('uses date, device type and numeric session in the R2 log filename',()=>{
    const snapshot=normalizeRuntimeDiagnosticSnapshot(rawSnapshot);
    expect(runtimeDiagnosticKey(snapshot)).toBe('runtime-logs/2026-09-09/2026-09-09_ios_session-1788950000123.log');
  });

  it('renders session metadata, stages, module results, durations and redacted errors without arbitrary secrets',()=>{
    const snapshot=normalizeRuntimeDiagnosticSnapshot(rawSnapshot);
    const log=renderRuntimeDiagnosticLog(snapshot,'2026-09-09T11:59:00.000Z');
    expect(log).toContain('device_type: ios');
    expect(log).toContain('telegram_platform: ios');
    expect(log).toContain('build_id: BUILD-TEST');
    expect(log).toContain('stage=new-post.preparation');
    expect(log).toContain('module=composer-editor-runtime');
    expect(log).toContain('status=loaded');
    expect(log).toContain('duration_ms=240');
    expect(log).toContain('error=TypeError: bridge failed token=[redacted]');
    expect(log).not.toContain('supersecret');
    expect(log).not.toContain('must-not-be-persisted');
  });

  it('overwrites the same session artifact with the cumulative snapshot after each event delivery',async()=>{
    const put=vi.fn(async()=>undefined),env={ARTIFACTS:{put}} as unknown as Env;
    const snapshot=normalizeRuntimeDiagnosticSnapshot(rawSnapshot);
    await expect(storeRuntimeDiagnosticSnapshot(env,snapshot,'2026-09-09T11:59:00.000Z')).resolves.toEqual({key:'runtime-logs/2026-09-09/2026-09-09_ios_session-1788950000123.log',eventCount:3});
    expect(put).toHaveBeenCalledOnce();
    expect(put).toHaveBeenCalledWith('runtime-logs/2026-09-09/2026-09-09_ios_session-1788950000123.log',expect.stringContaining('003 | 2026-09-09T11:58:01.300Z'),{httpMetadata:{contentType:'text/plain; charset=utf-8'}});
  });

  it('rejects unsupported event statuses instead of storing arbitrary diagnostic payloads',()=>{
    expect(()=>normalizeRuntimeDiagnosticSnapshot({...rawSnapshot,events:[{...rawSnapshot.events[0],status:'whatever'}]})).toThrow(/неизвестный status/);
  });
});
