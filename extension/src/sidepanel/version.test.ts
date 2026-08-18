import {afterEach, describe, expect, it, vi} from 'vitest';
import {extensionVersionLabel} from './version';

afterEach(() => vi.unstubAllGlobals());

describe('side-panel version', () => {
  it('uses the manifest version as its single source of truth', () => {
    vi.stubGlobal('chrome', {runtime: {getManifest: () => ({version: '9.8.7'})}});
    expect(extensionVersionLabel()).toBe('v9.8.7');
  });
});
