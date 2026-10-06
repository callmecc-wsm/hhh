// Unit composition of the actual upstream loop; scripted model and one real tool implementation.
// This is not a shipped-profile end-to-end run.
import { it, expect } from 'vitest'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createUserMessage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { defineContentToolFixture } from '@deepseek-ai/dsh-tools'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { MockAdapter, textResponse, toolCallResponse } from '../repos/deepseek-harness/packages/core/agent-loop/tests/mock-adapter.ts'

it('records the actual request projection and tool result round-trip', async()=>{
  const adapter=new MockAdapter([toolCallResponse('call_test','verify',{}),textResponse('完成了。')])
  const ctx=new Context()
  try {
    for(const Plugin of [LlmRuntime,SessionStore,SessionProjectionRegistry,SystemPrompt,ToolRuntime,AgentRegistry]) await ctx.plugin(Plugin)
    await ctx.plugin(AgentLoop,{agents:[]})
    ctx.llm.registerAdapter(['mock'],adapter)
    ctx.tools.register(defineContentToolFixture({name:'verify',description:'A controlled failing acceptance check',parameters:{},async execute(){return [{type:'text',text:'FAIL: add(2,3) returned -1; expected 5'}]}}))
    const agent=await ctx.agentLoop.create(SessionId('harness-research'),{provider:'mock',model:'mock'})
    const idle=new Promise<void>(resolve=>{const off=ctx.on('agent/status',({agent:subject,status})=>{if(subject===agent && status==='idle'){off();resolve()}})})
    agent.followup(createUserMessage({content:[{type:'text',text:'Fix add and verify.'}],source:{kind:'user'}}))
    await idle
    const events=agent.session.snapshotEvents()
    const data={kind:'actual upstream plugin unit composition; scripted provider and controlled verification output; not CLI E2E',requests:adapter.requests.map(r=>({messages:r.messages,tools:r.tools,model:r.model})),events,derivedMessages:agent.session.deriveMessages()}
    writeFileSync(path.resolve(import.meta.dirname,'../evidence/deepseek-trace.json'),JSON.stringify(data,null,2))
    expect(adapter.requests).toHaveLength(2)
    expect(events.at(-1)).toMatchObject({type:'turn/end',data:{reason:{kind:'completed'}}})
  } finally {await ctx.fiber.dispose()}
})
