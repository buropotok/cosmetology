import {describe, expect, it} from 'vitest';
import {JSDOM} from 'jsdom';
import html from '../index.html?raw';

describe('Before/After side-panel layout', () => {
  it('shows horizontal selected, vertical disabled, and two correctly ordered slots', () => {
    const document = new JSDOM(html).window.document;
    const layouts = document.querySelectorAll<HTMLButtonElement>('.ba-layouts button');
    expect(layouts[0].textContent).toContain('ДО | ПОСЛЕ');
    expect(layouts[0].classList.contains('selected')).toBe(true);
    expect(layouts[1].disabled).toBe(true);
    expect([...document.querySelectorAll<HTMLElement>('[data-ba-slot]')].map(slot => slot.dataset.baSlot)).toEqual(['before', 'after']);
    expect(document.querySelector<HTMLButtonElement>('#beforeAfterSave')?.disabled).toBe(true);
    expect(document.querySelector<HTMLTextAreaElement>('#text')?.placeholder).toBe('Напишите текст публикации...');
  });
});
