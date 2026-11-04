// Bundles src/ into one self-contained index.html for publishing.
import {build} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
const out=await build({entryPoints:['src/app.js'],bundle:true,format:'iife',write:false,target:'es2020',charset:'utf8'});
const js=out.outputFiles[0].text.replace(/<\/script/g,'<\\/script');
const html=readFileSync('src/template.html','utf8').replace('/*__BUNDLE__*/',()=>js);
writeFileSync('index.html',html);
console.log('built index.html',html.length,'bytes');
