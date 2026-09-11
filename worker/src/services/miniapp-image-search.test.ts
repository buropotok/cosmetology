import { describe, expect, it } from 'vitest';
import { extractExpectedOfficialHost, extractPageImageCandidates, officialHostMatches } from './miniapp-image-search';

describe('official image page extraction',()=>{
  it('prefers real page metadata and resolves relative image URLs',()=>{
    const html=`<html><head>
      <meta property="og:image" content="/media/product.jpg">
      <meta name="twitter:image" content="https://cdn.example.com/product.webp">
    </head></html>`;
    expect(extractPageImageCandidates(html,'https://brand.example/products/test')).toEqual([
      'https://brand.example/media/product.jpg',
      'https://cdn.example.com/product.webp',
    ]);
  });

  it('ignores unsafe non-https image candidates',()=>{
    const html=`<meta property="og:image" content="http://brand.example/product.jpg">
      <meta name="twitter:image" content="https://brand.example/ok.jpg">`;
    expect(extractPageImageCandidates(html,'https://brand.example/product')).toEqual([
      'https://brand.example/ok.jpg',
    ]);
  });
});

describe('official grounded source selection',()=>{
  it('accepts only the hostname explicitly selected by the grounded answer',()=>{
    expect(extractExpectedOfficialHost('FOUND — Test Product — www.brand.example')).toBe('brand.example');
    expect(officialHostMatches('products.brand.example','brand.example')).toBe(true);
    expect(officialHostMatches('unrelated-store.example','brand.example')).toBe(false);
  });

  it('rejects malformed FOUND responses without an official hostname',()=>{
    expect(extractExpectedOfficialHost('FOUND — Test Product')).toBe('');
    expect(extractExpectedOfficialHost('FOUND — Test Product — http://brand.example/path')).toBe('');
  });
});
