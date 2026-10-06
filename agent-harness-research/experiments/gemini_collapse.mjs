// Execute the unmodified, dependency-free declarations extracted with the TS AST.
// This is a function-level source experiment, not a full Gemini CLI run.
import ts from 'typescript';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const filename=path.join(root,'repos/gemini-cli/packages/core/src/context/chatCompressionService.ts');
const source=fs.readFileSync(filename,'utf8');
const ast=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true);
const names=new Set(['RECENT_TURNS_PROTECTED','RETRIEVAL_TOOL_NAMES_EXEMPT_FROM_COLLAPSE','isExemptRetrievalTool','COLLAPSED_FUNCTION_RESPONSE_MAX_BYTES','defaultGraphemeSegmenter','collapseOlderFunctionResponses']);
const snippets=ast.statements.filter(n=>names.has(n.name?.text)||n.declarationList?.declarations.some(d=>names.has(d.name?.text))).map(n=>n.getText(ast));
if(snippets.length!==6)throw new Error('Pinned source shape changed');
const js=ts.transpileModule(snippets.join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const compiled=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const history=['run_shell_command','read_file','run_shell_command','run_shell_command','run_shell_command'].map((name,i)=>({role:'user',parts:[{functionResponse:{name,response:{output:`${i}:`+'日志'.repeat(1000)}}}]}));
const runs=[1,3].map(protectedTurns=>{const after=compiled.collapseOlderFunctionResponses(history,100,undefined,protectedTurns);return {protectedTurns,entries:after.map((x,i)=>({index:i,tool:x.parts[0].functionResponse.name,beforeBytes:Buffer.byteLength(history[i].parts[0].functionResponse.response.output),afterBytes:Buffer.byteLength(x.parts[0].functionResponse.response.output),collapsed:x.parts[0].functionResponse.response.output!==history[i].parts[0].functionResponse.response.output,preview:x.parts[0].functionResponse.response.output.slice(0,180)}))}});
fs.writeFileSync(path.join(root,'evidence/gemini-collapse.json'),JSON.stringify({kind:'AST-extracted exact upstream declarations; no CLI/model request',source:filename,runs},null,2));
console.log(JSON.stringify(runs.map(r=>({protectedTurns:r.protectedTurns,collapsed:r.entries.map(e=>e.collapsed)}))));
