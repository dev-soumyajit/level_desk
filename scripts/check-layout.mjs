import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname,relative,resolve } from 'node:path';
const require=createRequire(import.meta.url),ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function collect(folder){return readdirSync(folder,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?collect(folder+'/'+entry.name):/\.tsx?$/.test(entry.name)?[folder+'/'+entry.name]:[]);}
const files=['src/lib','src/components'].flatMap(collect);
for(const file of files){
 const target=resolve('artifacts/static-preview',file.replace(/\.tsx?$/,'.js'));mkdirSync(dirname(target),{recursive:true});
 let source=readFileSync(file,'utf8').replace(/(['"])@\/([^'"]+)\1/g,(_,quote,spec)=>{let target=relative(dirname(file),'src/'+spec).replaceAll('\\','/');if(!target.startsWith('.'))target='./'+target;return quote+target+quote;});
 writeFileSync(target,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText);
}
writeFileSync('artifacts/static-preview/package.json','{"type":"commonjs"}');
const Workspace=require(resolve('artifacts/static-preview/src/components/workspace.js')).default;
const postcss=require('postcss');
const css=(await postcss([require('@tailwindcss/postcss')({base:resolve('.')})]).process(readFileSync('src/app/globals.css','utf8'),{from:resolve('src/app/globals.css')})).css;
const html=renderToStaticMarkup(React.createElement(Workspace));
writeFileSync('artifacts/mobile-preview.html',`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${css}</style></head><body>${html}</body></html>`);
console.log('Created an isolated static layout preview from the actual React components.');


if(existsSync('artifacts/sample-analysis.json')){
const {detectPage}=require(resolve('artifacts/static-preview/src/lib/detection.js'));
const VendorTools=require(resolve('artifacts/static-preview/src/components/vendor-tools.js')).default;
const fixture=JSON.parse(readFileSync('artifacts/sample-analysis.json','utf8'));
const sample={...detectPage(fixture.tokens,fixture.width,fixture.height,fixture.scan),id:'sample',sourceId:'source',fileName:'sample.pdf',pageIndex:0,width:595,height:842,transform:[1,0,0,-1,0,842],included:true,approved:false,overrides:{}};
const tools=renderToStaticMarkup(React.createElement(VendorTools,{pages:[sample],setPages:()=>{},mode:'label',locked:false,onReview:()=>{},allowReprints:false,setAllowReprints:()=>{},onError:()=>{}}));
writeFileSync('artifacts/vendor-tools-layout.html',`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${css}</style></head><body><div class="app-shell"><main>${tools}</main></div></body></html>`);
console.log('Populated vendor tools render successfully with the sample metadata (static source check).');

}
