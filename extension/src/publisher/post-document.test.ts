import {describe,expect,it} from 'vitest';
import {deserializePostDocument, documentText, hasTelegramSpecificFormatting, plainTextToDocument, safeLink, type PostDocument} from '../../../shared/post-document';
import {planTelegramPublication,renderTelegram} from '../../../shared/telegram-renderer';
import {renderVK} from '../../../shared/vk-renderer';

const marks=['bold','italic','underline','strikethrough','spoiler'] as const;
const document:PostDocument={schemaVersion:1,blocks:[
  {type:'paragraph',content:[{text:'Обычный\nтекст'}]},
  {type:'heading',content:[{text:'Заголовок'}]},
  {type:'quote',content:[{text:'Цитата'}]},
  {type:'bullet_list',items:[[{text:'один'}],[{text:'два'}]]},
  {type:'ordered_list',items:[[{text:'первый'}],[{text:'второй'}]]},
  {type:'details',emoji:'🌿',content:[{text:'Скрытый текст',marks:marks.map(type=>({type}))}]},
  {type:'paragraph',content:[{text:'ссылка',marks:[{type:'link',href:'https://example.com/path'}]}]}
]};

describe('canonical PostDocument',()=>{
  it('migrates plain text without losing blank lines or paragraphs',()=>{const migrated=plainTextToDocument('первая\n\nтретья');expect(migrated.blocks).toHaveLength(3);expect(documentText(migrated)).toBe('первая\n\nтретья')});
  it('serializes and deserializes structured content',()=>expect(deserializePostDocument(JSON.parse(JSON.stringify(document)))).toEqual(document));
  it('falls back from an old or invalid draft to its plain text',()=>expect(documentText(deserializePostDocument({schemaVersion:0},'старый текст'))).toBe('старый текст'));
  it('rejects unsafe links',()=>{expect(safeLink('javascript:alert(1)')).toBeNull();expect(safeLink('data:text/html,x')).toBeNull();expect(safeLink('https://safe.test')).toBe('https://safe.test/')});
  it('detects Telegram-specific content for the VK warning',()=>expect(hasTelegramSpecificFormatting(document)).toBe(true));
});

describe('platform renderers',()=>{
  it('renders every block, inline mark, combinations and line breaks as Telegram HTML',()=>{const result=renderTelegram(document);expect(result.html).toContain('Обычный\nтекст\n<b>Заголовок</b>');expect(result.html).toContain('<blockquote>Цитата</blockquote>');expect(result.html).toContain('• один\n• два');expect(result.html).toContain('1. первый\n2. второй');expect(result.html).toContain('<blockquote expandable>');expect(result.html).toContain('<b><i><u><s><tg-spoiler>Скрытый текст</tg-spoiler></s></u></i></b>');expect(result.html).toContain('<a href="https://example.com/path">ссылка</a>')});
  it('uses one representation for preview semantics and API HTML',()=>{const result=renderTelegram(document);expect(result.blocks.map(block=>(block.prefix??'')+(block.title?.map(segment=>segment.text).join('')?block.title.map(segment=>segment.text).join('')+'\n\n':'')+block.segments.map(segment=>segment.text).join('')).join('\n')).toBe(result.plainText);expect(result.blocks.find(block=>block.source==='details')?.kind).toBe('expandable_quote')});
  it('preserves details in VK and wraps it in paired emoji markers',()=>{const vk=renderVK(document);expect(vk).toContain('🌿🌿🌿🌿 Подробнее 🌿🌿🌿🌿');expect(vk).toContain('Скрытый текст');expect(vk).toContain('🌿'.repeat(14))});
  it('uses the same delivery plan for preview and publishing',()=>{const rendered=renderTelegram(document);expect(planTelegramPublication(rendered,false).type).toBe('text');expect(planTelegramPublication(rendered,true).type).toBe('photo_with_caption');const long={...rendered,plainText:'x'.repeat(1025)};expect(planTelegramPublication(long,true)).toMatchObject({type:'photo_then_text',reason:'caption_too_long'})});
  it('renders a details title with Telegram spacing and a default fallback',()=>{const rendered=renderTelegram({schemaVersion:1,blocks:[{type:'details',title:[{text:'Заголовок 1'}],content:[{text:'Скрытый текст'}]},{type:'details',title:[],content:[{text:'Другой текст'}]}]});expect(rendered.html).toContain('<blockquote expandable><b>Заголовок 1</b>\n\nСкрытый текст</blockquote>');expect(rendered.html).toContain('<blockquote expandable><b>Подробнее</b>\n\nДругой текст</blockquote>')});
});
