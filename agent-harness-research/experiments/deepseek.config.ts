import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import ts from 'typescript'
import path from 'node:path'
import { standardDecoratorPlugin, vitestExecArgv } from '../repos/deepseek-harness/vitest.shared.ts'
const root=path.resolve(import.meta.dirname,'../repos/deepseek-harness')
const config=ts.readConfigFile(path.join(root,'tsconfig.base.json'),ts.sys.readFile).config
const aliases=Object.entries(config.compilerOptions.paths).map(([name,targets])=>({find:name.includes('*')?new RegExp('^'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace('\\*','(.*)')+'$'):name,replacement:path.join(root,(targets as string[])[0]).replace('*','$1')}))
export default defineConfig({
  resolve:{alias:aliases},
  plugins:[tsconfigPaths({projects:[path.join(root,'tsconfig.base.json')]}),standardDecoratorPlugin()],
  test:{include:[path.resolve(import.meta.dirname,'deepseek_trace.spec.ts')],pool:'forks',execArgv:vitestExecArgv},
})
