import test from 'node:test';
import assert from 'node:assert/strict';
import {serializePostDocumentForVk} from './vk-text-serializer.js';

test('serializes PostDocument into VK clipboard text',()=>{
  const document={
    schemaVersion:2,
    blocks:[
      {type:'heading',content:[{text:'Почему кожа становится сухой'}]},
      {type:'paragraph',content:[{text:'Одна из основных причин — нарушение кожного барьера.'}]},
      {type:'quote',blocks:[{type:'paragraph',content:[{text:'Увлажнение кожи и восстановление барьера — не одно и то же.'}]}]},
      {type:'details',title:[{text:'Что делать?'}],blocks:[
        {type:'paragraph',content:[{text:'Использовать мягкое очищение'}]},
        {type:'paragraph',content:[{text:'Добавить средства с церамидами'}]},
        {type:'paragraph',content:[{text:'Не забывать про SPF'}]}
      ]},
      {type:'bullet_list',items:[
        {content:[{text:'агрессивное очищение'}]},
        {content:[{text:'ретиноиды'}]}
      ]},
      {type:'ordered_list',items:[
        {content:[{text:'Очищение'}]},
        {content:[{text:'Сыворотка'}]}
      ]}
    ]
  };

  assert.equal(serializePostDocumentForVk(document),[
    'ПОЧЕМУ КОЖА СТАНОВИТСЯ СУХОЙ 👋',
    '',
    'Одна из основных причин — нарушение кожного барьера.',
    '',
    '💬 Увлажнение кожи и восстановление барьера — не одно и то же. 💬',
    '',
    '🌸 Что делать?',
    '    🌸 Использовать мягкое очищение',
    '    🌸 Добавить средства с церамидами',
    '    🌸 Не забывать про SPF',
    '',
    '• агрессивное очищение',
    '• ретиноиды',
    '',
    '1. Очищение',
    '2. Сыворотка'
  ].join('\n'));
});

test('preserves link and spoiler semantics and nested list indentation',()=>{
  const document={blocks:[
    {type:'paragraph',content:[
      {text:'Подробнее',marks:[{type:'link',href:'https://example.com/'}]},
      {text:' и секрет',marks:[{type:'spoiler'}]}
    ]},
    {type:'bullet_list',items:[
      {content:[{text:'Первый'}],children:{type:'ordered_list',items:[
        {content:[{text:'Вложенный'}]}
      ]}}
    ]}
  ]};

  assert.equal(serializePostDocumentForVk(document),[
    'Подробнее — https://example.com/ и 🙈 секрет',
    '',
    '• Первый',
    '    1. Вложенный'
  ].join('\n'));
});

test('returns empty text for malformed or empty input',()=>{
  assert.equal(serializePostDocumentForVk(null),'');
  assert.equal(serializePostDocumentForVk({}),'');
  assert.equal(serializePostDocumentForVk({blocks:[]}),'');
});
