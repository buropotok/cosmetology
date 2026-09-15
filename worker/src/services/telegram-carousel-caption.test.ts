import {describe,expect,it} from 'vitest';
import {buildTelegramMediaBlock,buildTelegramMediaHtml} from './telegram';

const CAPTION='Прокрутите влево или вправо';

describe('Telegram carousel navigation caption',()=>{
  it('adds the caption to a slideshow with more than one photo',()=>{
    expect(buildTelegramMediaBlock(3,'slideshow')).toMatchObject({type:'slideshow',caption:{text:CAPTION}});
    expect(buildTelegramMediaHtml(3,'slideshow')).toContain(`<figcaption>${CAPTION}</figcaption>`);
  });

  it('does not add the caption to a single photo or collage',()=>{
    expect(buildTelegramMediaBlock(1,'slideshow')).not.toHaveProperty('caption');
    expect(buildTelegramMediaBlock(3,'collage')).not.toHaveProperty('caption');
    expect(buildTelegramMediaHtml(1,'slideshow')).not.toContain('<figcaption>');
    expect(buildTelegramMediaHtml(3,'collage')).not.toContain('<figcaption>');
  });
});
