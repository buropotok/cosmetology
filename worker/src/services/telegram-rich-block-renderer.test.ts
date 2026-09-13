import {describe,expect,it} from 'vitest';
import {renderTelegram} from '../../../shared/telegram-renderer';

describe('Telegram direct rich block rendering',()=>{
  it('preserves structural blocks and nested inline marks',()=>{
    const rendered=renderTelegram({schemaVersion:2,blocks:[
      {type:'heading',content:[{text:'Заголовок',marks:[{type:'bold'}]}]},
      {type:'details',title:[{text:'Подробнее'}],blocks:[
        {type:'paragraph',content:[{text:'важно',marks:[{type:'italic'},{type:'link',href:'https://example.com'}]}]},
      ]},
      {type:'quote',blocks:[{type:'paragraph',content:[{text:'цитата',marks:[{type:'spoiler'}]}]}]},
    ]});

    expect(rendered.richMessageBlocks).toEqual([
      {type:'heading',size:1,text:{type:'bold',text:'Заголовок'}},
      {type:'details',summary:'Подробнее',blocks:[
        {type:'paragraph',text:{type:'italic',text:{type:'url',text:'важно',url:'https://example.com/'}}},
      ]},
      {type:'blockquote',blocks:[
        {type:'paragraph',text:{type:'spoiler',text:'цитата'}},
      ]},
    ]);
  });
});
