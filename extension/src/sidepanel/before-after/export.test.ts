import {afterEach, describe, expect, it, vi} from 'vitest';
import {buildBeforeAfterFilename, downloadComposedImage} from './export';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Before/After export', () => {
  it('uses a readable local date/time filename', () => {
    expect(buildBeforeAfterFilename(new Date(2026, 7, 18, 3, 54))).toBe('До-После-2026-08-18-0354.png');
  });

  it('downloads only the composed Blob with Save As and revokes its URL', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:composed');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const download = vi.fn(async () => 7);
    vi.stubGlobal('chrome', {downloads: {download}});
    const blob = new Blob(['final'], {type: 'image/png'});

    await downloadComposedImage(blob, 'До-После-2026-08-18.png');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(download).toHaveBeenCalledWith({url: 'blob:composed', filename: 'До-После-2026-08-18.png', saveAs: true});
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:composed');
  });
});
