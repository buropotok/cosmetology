import {describe, expect, it} from 'vitest';
import {JSDOM} from 'jsdom';
import html from '../index.html?raw';

describe('Before/After side-panel layout', () => {
  it('shows horizontal selected by default and an enabled vertical option', () => {
    const document = new JSDOM(html).window.document;
    const layouts = document.querySelectorAll<HTMLButtonElement>('.ba-layouts button');
    expect(layouts[0].textContent).toContain('ДО | ПОСЛЕ');
    expect(layouts[0].classList.contains('selected')).toBe(true);
    expect(layouts[0].dataset.baLayout).toBe('horizontal');
    expect(layouts[1].dataset.baLayout).toBe('vertical');
    expect(layouts[1].disabled).toBe(false);
    expect([...document.querySelectorAll<HTMLElement>('[data-ba-slot]')].map(slot => slot.dataset.baSlot)).toEqual(['before', 'after']);
    expect(document.querySelector<HTMLButtonElement>('#beforeAfterSave')?.disabled).toBe(true);
    expect(document.querySelector<HTMLElement>('#editor')?.getAttribute('role')).toBe('textbox');
    expect(document.querySelectorAll('.toolbar svg')).toHaveLength(7);
    expect(document.querySelector('[data-action="image"]')?.getAttribute('aria-label')).toBe('Изображение');
    expect(document.querySelector('.block-picker')?.textContent).toContain('Aa');
  });
});
