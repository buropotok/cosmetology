import {beforeEach, describe, expect, it} from 'vitest';
import {JSDOM} from 'jsdom';
import {PublishWorkflow} from './publish-workflow';
import {extractTitle} from '../publisher/draft';

beforeEach(() => {
  const dom = new JSDOM('<main><article id="a"></article><article id="b"></article></main>');
  Object.assign(globalThis, {document: dom.window.document, HTMLElement: dom.window.HTMLElement});
});

describe('publish workflow state', () => {
  it('isolates a restarted workflow from the previous post and image', () => {
    const workflow = new PublishWorkflow();
    const first = document.querySelector<HTMLElement>('#a')!;
    const second = document.querySelector<HTMLElement>('#b')!;
    workflow.start(first, 'First post');
    workflow.waitForImage('illustration', 1);
    workflow.setCandidate(first, {url: 'old-image', filename: 'old.png'});

    workflow.start(second, 'Second post');

    expect(workflow.state).toMatchObject({kind: 'photo_choice', source: second, originalText: 'Second post'});
  });

  it('extracts the first non-empty Markdown heading deterministically', () => {
    expect(extractTitle('\n  ### Заголовок публикации  \nТекст')).toBe('Заголовок публикации');
    expect(extractTitle('Без маркера\nТекст')).toBe('Без маркера');
  });
});
