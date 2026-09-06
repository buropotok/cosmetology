import {describe,expect,it} from 'vitest';
import {isPostDocument,type PostDocument} from '../../../shared/post-document';
import {renderTelegram} from '../../../shared/telegram-renderer';

const structured:PostDocument={
  schemaVersion:2,
  blocks:[{
    type:'quote',
    blocks:[
      {type:'paragraph',content:[{text:'Введение'}]},
      {type:'bullet_list',items:[{content:[{text:'Пункт'}],children:{type:'ordered_list',items:[{content:[{text:'Подпункт'}]}]}}]},
      {type:'details',title:[{text:'Подробнее'}],blocks:[{type:'paragraph',content:[{text:'Скрытый текст',marks:[{type:'bold'}]}]}]},
    ],
  }],
};

describe('recursive PostDocument structure',()=>{
  it('accepts a quote containing lists and details with typed nested lists',()=>{
    expect(isPostDocument(structured)).toBe(true);
  });

  it('compiles the nested structure to Telegram Rich Message HTML without flattening',()=>{
    const rendered=renderTelegram(structured);
    expect(rendered.richMessageHtml).toBe('<blockquote><p>Введение</p><ul><li><p>Пункт</p><ol><li>Подпункт</li></ol></li></ul><details><summary>Подробнее</summary><p><b>Скрытый текст</b></p></details></blockquote>');
    expect(rendered.plainText).toContain('• Пункт');
    expect(rendered.plainText).toContain('  1. Подпункт');
    expect(rendered.plainText).toContain('Подробнее');
  });

  it('keeps the compact Gemini-style quote form valid',()=>{
    const compact:PostDocument={schemaVersion:2,blocks:[{type:'quote',content:[{text:'Короткая цитата'}]}]};
    expect(isPostDocument(compact)).toBe(true);
    const rendered=renderTelegram(compact);
    expect(rendered.richMessageHtml).toBeUndefined();
    expect(rendered.html).toBe('<blockquote>Короткая цитата</blockquote>');
  });

  it('accepts legacy untyped nested-list children for existing drafts',()=>{
    const legacy:PostDocument={schemaVersion:2,blocks:[{type:'bullet_list',items:[{content:[{text:'A'}],children:[{content:[{text:'B'}]}]}]}]};
    expect(isPostDocument(legacy)).toBe(true);
    expect(renderTelegram(legacy).richMessageHtml).toContain('<ul><li><p>A</p><ul><li>B</li></ul></li></ul>');
  });
});
