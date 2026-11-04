// Bundles src/ into one self-contained index.html for publishing.
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const out=await build({entryPoints:['src/app.js'],bundle:true,format:'iife',write:false,target:'es2020',charset:'utf8',minify:true});
const js=out.outputFiles[0].text.replace(/<\/script/g,'<\\/script');
const body='\n'+js+'\n';
// the page only runs the exact script it shipped with, so injected code cannot execute
const hash='sha256-'+createHash('sha256').update(body,'utf8').digest('base64');
const html=readFileSync('src/template.html','utf8').replace('__SCRIPT_HASH__',hash).replace('\n/*__BUNDLE__*/\n',()=>body);
writeFileSync('index.html',html);
console.log('built index.html',html.length,'bytes');
