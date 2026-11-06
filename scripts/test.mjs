import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const files = ['src/lib/order-types.ts','src/lib/order-metadata.ts','src/lib/batch.ts','src/lib/reports.ts','src/lib/types.ts','src/lib/detection.ts','src/lib/geometry.ts','src/lib/paper.ts','tests/core.test.ts','tests/vendor.test.ts'];
for(const file of files){
 const target=resolve('artifacts/unit',file.replace(/\.ts$/,'.js'));
 mkdirSync(dirname(target),{recursive:true});
 const result=ts.transpileModule(readFileSync(file,'utf8'),{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 const errors=(result.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 if(errors.length)throw new Error(file+': '+errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
 writeFileSync(target,result.outputText);
}
writeFileSync(resolve('artifacts/unit/package.json'),'{"type":"commonjs"}');
await import(pathToFileURL(resolve('artifacts/unit/tests/core.test.js')).href);

await import(pathToFileURL(resolve('artifacts/unit/tests/vendor.test.js')).href);
