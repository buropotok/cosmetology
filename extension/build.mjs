import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist',{recursive:true,force:true}); await mkdir('dist',{recursive:true});
await Promise.all([
 build({entryPoints:['src/content/index.ts'],bundle:true,outfile:'dist/content.js',format:'iife',target:'chrome120'}),
 build({entryPoints:['src/background.ts'],bundle:true,outfile:'dist/background.js',format:'iife',target:'chrome120'}),
 build({entryPoints:['src/sidepanel/index.ts'],bundle:true,outfile:'dist/sidepanel.js',format:'iife',target:'chrome120'})
]);
await Promise.all(['manifest.json','src/content/content.css'].map(x=>cp(x,'dist/'+x.split('/').at(-1))));
await cp('src/sidepanel/index.html','dist/sidepanel.html'); await cp('src/sidepanel/style.css','dist/sidepanel.css');
