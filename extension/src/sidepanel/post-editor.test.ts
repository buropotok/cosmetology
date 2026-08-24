// @vitest-environment jsdom
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {PostEditor} from './post-editor';

describe('PostEditor formatting toggles',()=>{
  beforeEach(()=>{document.body.innerHTML='<div id="editor"></div>';vi.stubGlobal('alert',vi.fn());vi.stubGlobal('prompt',vi.fn())});
  it.each(['bold','italic','underline','strikethrough','spoiler'] as const)('applies and removes %s on a second action',type=>{
    const editor=new PostEditor(document.querySelector('#editor')!,undefined,'Текст',()=>{}),block=document.querySelector<HTMLElement>('[data-block]')!;
    const range=document.createRange();range.selectNodeContents(block);const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range);
    expect(editor.applyMark(type)).toBe(true);
    expect((editor.document().blocks[0] as any).content[0].marks).toContainEqual({type});
    expect(editor.applyMark(type)).toBe(false);
    expect((editor.document().blocks[0] as any).content[0].marks).toBeUndefined();
  });
  it('formats a selection spanning multiple paragraphs',()=>{
    const editor=new PostEditor(document.querySelector('#editor')!,undefined,'Первый\nВторой',()=>{}),blocks=document.querySelectorAll<HTMLElement>('[data-block]');
    const range=document.createRange();range.setStart(blocks[0].firstChild!,0);range.setEnd(blocks[1].firstChild!,6);const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range);
    editor.applyMark('bold');
    expect(editor.document().blocks.map(block=>'content'in block?block.content[0].marks:undefined)).toEqual([[{type:'bold'}],[{type:'bold'}]]);
  });
});
