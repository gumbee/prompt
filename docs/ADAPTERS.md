# Adapters

SDK-specific adapters for rendering prompts.

## Overview

Each adapter is a standalone entry point that:

- Exports a `prompt()` function producing SDK-specific output
- Re-exports all components for convenience
- Uses official SDK types for type safety

Import everything you need from a single entry point:

```tsx
import { System, User, If, Each, prompt } from "@gumbee/prompt/openai"
```

## OpenAI

For use with the [OpenAI SDK](https://github.com/openai/openai-node).

```bash
bun add openai
```

```tsx
import { System, User, prompt } from "@gumbee/prompt/openai"
import OpenAI from "openai"

function GreetingPrompt() {
  return (
    <>
      <System>You are a helpful assistant.</System>
      <User>Hello!</User>
    </>
  )
}

const client = new OpenAI()
const messages = prompt(<GreetingPrompt />)

const response = await client.chat.completions.create({
  model: "gpt-4",
  messages, // ChatCompletionMessageParam[]
})
```

**Output Format:**

```typescript
type OpenAIMessage = ChatCompletionMessageParam
// Array of { role, content, tool_call_id?, name? }
```

**Multiple System Messages:**

Multiple `<System>` components create multiple system messages in the array:

```tsx
function MultiSystemPrompt() {
  return (
    <>
      <System>You are a helpful assistant.</System>
      <System>Always respond in JSON.</System>
      <User>Hello!</User>
    </>
  )
}

const messages = prompt(<MultiSystemPrompt />)
// [
//   { role: 'system', content: 'You are a helpful assistant.' },
//   { role: 'system', content: 'Always respond in JSON.' },
//   { role: 'user', content: 'Hello!' }
// ]
```

**Tool Calls and Results:**

```tsx
import { User, ToolCall, ToolResult, Assistant, prompt } from '@gumbee/prompt/openai'

function WeatherConversation() {
  return (
    <>
      <User>What's the weather?</User>
      <ToolCall id="call_abc123" name="get_weather" args={{ city: "Tokyo" }} />
      <ToolResult id="call_abc123" name="get_weather">
        {"temperature": 22, "condition": "sunny"}
      </ToolResult>
      <Assistant>It's 22°C and sunny in Tokyo.</Assistant>
    </>
  )
}

const messages = prompt(<WeatherConversation />)
// [
//   { role: 'user', content: 'What\'s the weather?' },
//   { role: 'assistant', content: null, tool_calls: [{ id: 'call_abc123', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Tokyo"}' } }] },
//   { role: 'tool', content: '{"temperature": 22, "condition": "sunny"}', tool_call_id: 'call_abc123' },
//   { role: 'assistant', content: 'It\'s 22°C and sunny in Tokyo.' }
// ]
```

## Vercel AI SDK

For use with the [Vercel AI SDK](https://sdk.vercel.ai/).

```bash
bun add ai
```

```tsx
import { System, User, prompt } from "@gumbee/prompt/ai-sdk"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

function GreetingPrompt() {
  return (
    <>
      <System>You are a helpful assistant.</System>
      <User>Hello!</User>
    </>
  )
}

const messages = prompt(<GreetingPrompt />)

const { text } = await generateText({
  model: openai("gpt-4"),
  messages, // CoreMessage[]
})
```

**Output Format:**

```typescript
type AISDKMessage = CoreMessage
// Array of { role, content } or tool messages with toolCallId
```

**Multiple System Messages:**

Multiple `<System>` components create multiple system messages in the array:

```tsx
function MultiSystemPrompt() {
  return (
    <>
      <System>You are a helpful assistant.</System>
      <System>Always respond in JSON.</System>
      <User>Hello!</User>
    </>
  )
}

const messages = prompt(<MultiSystemPrompt />)
// [
//   { role: 'system', content: 'You are a helpful assistant.' },
//   { role: 'system', content: 'Always respond in JSON.' },
//   { role: 'user', content: 'Hello!' }
// ]
```

**Tool Calls and Results:**

```tsx
import { User, ToolCall, ToolResult, Assistant, prompt } from "@gumbee/prompt/ai-sdk"

function WeatherConversation() {
  return (
    <>
      <User>What's the weather?</User>
      <ToolCall id="call_abc123" name="get_weather" args={{ city: "Tokyo" }} />
      <ToolResult id="call_abc123" name="get_weather" json={{ temperature: 22 }} />
      <Assistant>It's 22°C in Tokyo.</Assistant>
    </>
  )
}

const messages = prompt(<WeatherConversation />)
// [
//   { role: 'user', content: 'What\'s the weather?' },
//   { role: 'assistant', content: [{ type: 'tool-call', toolCallId: 'call_abc123', toolName: 'get_weather', args: { city: 'Tokyo' } }] },
//   { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'call_abc123', toolName: 'get_weather', output: { type: 'json', value: { temperature: 22 } } }] },
//   { role: 'assistant', content: 'It\'s 22°C in Tokyo.' }
// ]
```

**Tool Result Output Types:**

The AI SDK adapter supports different output types based on props:

| Props Used         | Output Format                          |
| :----------------- | :------------------------------------- |
| Text children      | `{ type: "text", value: "..." }`       |
| `json` prop        | `{ type: "json", value: {...} }`       |
| Text + `isError`   | `{ type: "error-text", value: "..." }` |
| `json` + `isError` | `{ type: "error-json", value: {...} }` |

```tsx
// JSON result (structured data)
<ToolResult id="call_1" name="get_weather" json={{ temp: 22 }} />
// output: { type: "json", value: { temp: 22 } }

// Error result
<ToolResult id="call_1" name="get_weather" isError>
  City not found
</ToolResult>
// output: { type: "error-text", value: "City not found" }
```

## Anthropic

For use with the [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript).

```bash
bun add @anthropic-ai/sdk
```

Anthropic has a different API where system messages are passed separately:

```tsx
import { System, User, prompt } from "@gumbee/prompt/anthropic"
import Anthropic from "@anthropic-ai/sdk"

function GreetingPrompt() {
  return (
    <>
      <System>You are Claude, a helpful assistant.</System>
      <User>Hello!</User>
    </>
  )
}

const client = new Anthropic()
const { system, messages } = prompt(<GreetingPrompt />)

const response = await client.messages.create({
  model: "claude-3-opus-20240229",
  max_tokens: 1024,
  system, // string | undefined
  messages, // MessageParam[]
})
```

**Output Format:**

```typescript
interface AnthropicOutput {
  system: string | undefined // Combined system messages
  messages: MessageParam[] // Conversation messages
}
```

**Multiple System Messages:**

Multiple `<System>` blocks are combined with double newlines:

```tsx
function MultiSystemPrompt() {
  return (
    <>
      <System>You are a helpful assistant.</System>
      <System>Always be concise.</System>
    </>
  )
}

const { system } = prompt(<MultiSystemPrompt />)
// system: "You are a helpful assistant.\n\nAlways be concise."
```

**Tool Calls and Results:**

Anthropic uses `tool_use` blocks for tool calls and `tool_result` blocks (sent as user messages) for results:

```tsx
import { User, ToolCall, ToolResult, Assistant, prompt } from "@gumbee/prompt/anthropic"

function WeatherConversation() {
  return (
    <>
      <User>What's the weather?</User>
      <ToolCall id="toolu_abc123" name="get_weather" args={{ city: "Tokyo" }} />
      <ToolResult id="toolu_abc123" name="get_weather">
        <Json data={{ temperature: 22 }} />
      </ToolResult>
      <Assistant>It's 22°C in Tokyo.</Assistant>
    </>
  )
}

const { system, messages } = prompt(<WeatherConversation />)
// messages: [
//   { role: 'user', content: 'What\'s the weather?' },
//   { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_abc123', name: 'get_weather', input: { city: 'Tokyo' } }] },
//   { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_abc123', content: '...' }] },
//   { role: 'assistant', content: 'It\'s 22°C in Tokyo.' }
// ]
```

## Comparison

| Feature            | OpenAI                  | AI SDK                        | Anthropic                    |
| :----------------- | :---------------------- | :---------------------------- | :--------------------------- |
| System in messages | Yes                     | Yes                           | Separate                     |
| Tool call format   | `tool_calls[].function` | `content[].type: "tool-call"` | `content[].type: "tool_use"` |
| Tool result format | `tool_call_id`          | `toolCallId`                  | `tool_use_id` (as user msg)  |
| Output type        | `Message[]`             | `CoreMessage[]`               | `{ system, messages }`       |

## Prompt Options

All adapters support an optional second argument to the `prompt()` function:

### `messages` Option

Pass existing conversation messages for use with the `<WrapUser>` component:

```tsx
import { WrapUser, prompt } from "@gumbee/prompt/openai"

const existingMessages = [{ role: "user", content: "What's 2+2?" }]

const messages = prompt(
  <WrapUser tag="original" mode="suffix">
    Please respond in JSON format.
  </WrapUser>,
  { messages: existingMessages },
)
// The last user message is wrapped and combined with new content
```

This is useful for:

- Adding format requirements to existing queries
- Injecting context into ongoing conversations
- Building prompt enhancement middleware

See the [WrapUser documentation](./COMPONENTS.md#wrapuser) for more details.

## Creating Custom Adapters

The core package exports utilities for building custom adapters:

```tsx
import { renderToIR } from "@gumbee/prompt/render"
import type { IRMessage, IRToolCall, PromptNode } from "@gumbee/prompt"

// renderToIR produces intermediate representation:
// Array of { role, content, toolCalls?, toolCallId?, toolName? }

export function prompt(...nodes: PromptNode[]): YourSDKFormat {
  const ir = renderToIR(nodes)

  return ir.map((msg) => {
    // Handle tool calls (assistant requesting tools)
    if (msg.role === "assistant" && msg.toolCalls?.length) {
      return {
        role: "assistant",
        content: msg.content,
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          name: tc.name,
          arguments: tc.args,
        })),
      }
    }

    // Handle tool results
    if (msg.role === "tool") {
      return {
        role: "tool",
        content: msg.content,
        tool_call_id: msg.toolCallId,
      }
    }

    // Standard messages
    return {
      role: msg.role,
      content: msg.content,
    }
  })
}

// Re-export components
export { System, User, Assistant, ToolResult, ToolCall } from "@gumbee/prompt"
export { If, Show, Each } from "@gumbee/prompt"
export { Fragment } from "@gumbee/prompt"
```

**IR Message Type:**

```typescript
interface IRMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  toolCalls?: IRToolCall[] // For assistant messages with tool calls
  toolCallId?: string // For tool result messages
  toolName?: string // For tool result messages (some SDKs need it)
  toolResultJson?: unknown // Structured JSON result (for tool results)
  toolResultIsError?: boolean // Whether the tool result is an error
}

interface IRToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}
```
