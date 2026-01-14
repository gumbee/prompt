# Components

Message components for building LLM prompts.

## Message Components

### System

Sets the system prompt / instructions for the LLM.

```tsx
import { System, prompt } from "@gumbee/prompt/openai"

function TypeScriptAssistant() {
  return <System>You are a helpful assistant specialized in TypeScript. Always provide code examples when relevant.</System>
}

const messages = prompt(<TypeScriptAssistant />)
// [{ role: 'system', content: 'You are a helpful assistant...' }]
```

**Multiple System Messages**

You can use multiple `<System>` components. How they're handled depends on the adapter:

```tsx
function JsonAssistant() {
  return (
    <>
      <System>You are a helpful assistant.</System>
      <System>Always respond in JSON format.</System>
      <User>Hello!</User>
    </>
  )
}

const messages = prompt(<JsonAssistant />)
```

| Adapter   | Behavior                                                   |
| :-------- | :--------------------------------------------------------- |
| OpenAI    | Creates multiple system messages in the array              |
| AI SDK    | Creates multiple system messages in the array              |
| Anthropic | Combines into single `system` string with `\n\n` separator |

**Composing System Instructions**

For complex system prompts, you can compose them from multiple parts:

```tsx
function SystemPrompt({ persona, format }: { persona: string; format?: string }) {
  return (
    <System>
      {persona}
      {format && `\n\nOutput format: ${format}`}
    </System>
  )
}

function GenericsExplainer() {
  return (
    <>
      <SystemPrompt persona="You are an expert TypeScript developer." format="JSON" />
      <User>Explain generics.</User>
    </>
  )
}

const messages = prompt(<GenericsExplainer />)
```

**Nesting Behavior**

Message components should not be nested inside each other. Each `<System>`, `<User>`, `<Assistant>`, and `<ToolResult>` creates a separate message:

```tsx
// ❌ Don't nest message components
function BadExample() {
  return (
    <User>
      Hello!
      <System>This creates a separate system message, not nested content</System>
    </User>
  )
}

// ✅ Keep message components at the same level
function GoodExample() {
  return (
    <>
      <System>Instructions here.</System>
      <User>Hello!</User>
    </>
  )
}
```

### User

Represents user input in the conversation.

```tsx
import { User, prompt } from "@gumbee/prompt/openai"

function UserQuestion({ question }: { question: string }) {
  return <User>{question}</User>
}

const messages = prompt(<UserQuestion question="How do I use generics?" />)
// [{ role: 'user', content: 'How do I use generics?' }]
```

### Assistant

Represents assistant responses. Useful for few-shot prompting or continuing conversations.

```tsx
import { System, User, Assistant, prompt } from "@gumbee/prompt/openai"

function FewShotMath() {
  return (
    <>
      <System>You are a helpful assistant.</System>
      <User>What is 2 + 2?</User>
      <Assistant>2 + 2 equals 4.</Assistant>
      <User>What about 3 + 3?</User>
    </>
  )
}

const messages = prompt(<FewShotMath />)
```

### ToolCall

Represents the assistant requesting to use a tool. Used when replaying or constructing conversations that include tool usage.

```tsx
import { User, ToolCall, ToolResult, prompt } from "@gumbee/prompt/openai"

function WeatherConversation() {
  return (
    <>
      <User>What's the weather in Tokyo?</User>
      <ToolCall id="call_abc123" name="get_weather" input={{ city: "Tokyo" }} />
      <ToolResult id="call_abc123" name="get_weather">
        {JSON.stringify({ temperature: 22, condition: "sunny" })}
      </ToolResult>
    </>
  )
}

const messages = prompt(<WeatherConversation />)
```

**Props:**

| Prop    | Type                      | Description                          |
| :------ | :------------------------ | :----------------------------------- |
| `id`    | `string`                  | Unique identifier for this tool call |
| `name`  | `string`                  | Name of the tool being called        |
| `input` | `Record<string, unknown>` | Arguments passed to the tool         |

**Adapter Output:**

| Adapter   | Format                                                                                         |
| :-------- | :--------------------------------------------------------------------------------------------- |
| OpenAI    | `{ role: "assistant", tool_calls: [{ id, type: "function", function: { name, arguments } }] }` |
| AI SDK    | `{ role: "assistant", content: [{ type: "tool-call", toolCallId, toolName, input }] }`         |
| Anthropic | `{ role: "assistant", content: [{ type: "tool_use", id, name, input }] }`                      |

### ToolResult

Represents the result of a tool call. Used when providing results from tool executions back to the LLM.

**Basic Usage (Text Result):**

```tsx
import { User, ToolCall, ToolResult, Assistant, prompt } from "@gumbee/prompt/openai"

function WeatherWithResponse() {
  return (
    <>
      <User>What's the weather in Tokyo?</User>
      <ToolCall id="call_abc123" name="get_weather" input={{ city: "Tokyo" }} />
      <ToolResult id="call_abc123" name="get_weather">
        The weather is sunny and 22°C
      </ToolResult>
      <Assistant>The weather in Tokyo is 22°C and sunny!</Assistant>
    </>
  )
}

const messages = prompt(<WeatherWithResponse />)
```

**JSON Result (Preferred for Structured Data):**

Use the `json` prop for structured data. The AI SDK adapter will use the proper `{ type: "json", value: ... }` output format:

```tsx
function WeatherWithJsonResult() {
  return (
    <>
      <User>What's the weather in Tokyo?</User>
      <ToolCall id="call_abc123" name="get_weather" input={{ city: "Tokyo" }} />
      <ToolResult id="call_abc123" name="get_weather" json={{ temperature: 22, condition: "sunny" }} />
      <Assistant>The weather in Tokyo is 22°C and sunny!</Assistant>
    </>
  )
}
```

**Auto-Detection with Json Component:**

When `ToolResult` has a single `<Json>` child, it's automatically detected and treated as structured JSON:

```tsx
import { ToolResult, Json, prompt } from "@gumbee/prompt/ai-sdk"

// These are equivalent:
<ToolResult id="call_1" name="get_weather" json={{ temp: 22 }} />

<ToolResult id="call_1" name="get_weather">
  <Json data={{ temp: 22 }} />
</ToolResult>
```

**Error Results:**

Use `isError` to indicate the tool execution failed:

```tsx
// Text error
<ToolResult id="call_abc123" name="get_weather" isError>
  City not found
</ToolResult>

// JSON error (with structured error data)
<ToolResult id="call_abc123" name="get_weather" json={{ code: 404, message: "City not found" }} isError />
```

**Props:**

| Prop       | Type         | Description                                            |
| :--------- | :----------- | :----------------------------------------------------- |
| `id`       | `string`     | The tool call ID this result corresponds to (required) |
| `name`     | `string`     | The name of the tool (optional, some SDKs require it)  |
| `json`     | `unknown`    | Structured JSON result (preferred for structured data) |
| `isError`  | `boolean`    | Whether this result represents an error                |
| `children` | `PromptNode` | Text content (used when `json` prop is not provided)   |

**Adapter Output:**

| Adapter   | Format                                                                                      |
| :-------- | :------------------------------------------------------------------------------------------ |
| OpenAI    | `{ role: "tool", content: "...", tool_call_id: "..." }`                                     |
| AI SDK    | `{ role: "tool", content: [{ type: "tool-result", toolCallId, toolName, output: {...} }] }` |
| Anthropic | `{ role: "user", content: [{ type: "tool_result", tool_use_id, content }] }`                |

**AI SDK Output Types:**

The AI SDK adapter produces different output types based on props:

| Props Used         | Output Type                            |
| :----------------- | :------------------------------------- |
| Text children      | `{ type: "text", value: "..." }`       |
| `json` prop        | `{ type: "json", value: {...} }`       |
| Text + `isError`   | `{ type: "error-text", value: "..." }` |
| `json` + `isError` | `{ type: "error-json", value: {...} }` |

## Complete Tool Usage Example

Here's a full conversation with tool usage:

```tsx
import { System, User, Assistant, ToolCall, ToolResult, prompt } from "@gumbee/prompt/ai-sdk"

function MultiToolConversation() {
  return (
    <>
      <System>You can use tools to help answer questions.</System>
      <User>What's the weather in Tokyo and New York?</User>
      <ToolCall id="call_1" name="get_weather" input={{ city: "Tokyo" }} />
      <ToolCall id="call_2" name="get_weather" input={{ city: "New York" }} />
      <ToolResult id="call_1" name="get_weather" json={{ temperature: 22, condition: "sunny" }} />
      <ToolResult id="call_2" name="get_weather" json={{ temperature: 15, condition: "cloudy" }} />
      <Assistant>Tokyo: 22°C and sunny. New York: 15°C and cloudy.</Assistant>
    </>
  )
}

const messages = prompt(<MultiToolConversation />)
```

**Note:** Multiple consecutive `<ToolCall>` components are merged into a single assistant message with multiple tool calls, matching the expected format for all major LLM APIs.

**Handling Tool Errors:**

```tsx
function ToolWithError() {
  return (
    <>
      <User>What's the weather in Atlantis?</User>
      <ToolCall id="call_1" name="get_weather" input={{ city: "Atlantis" }} />
      <ToolResult id="call_1" name="get_weather" json={{ code: 404, message: "City not found" }} isError />
      <Assistant>I couldn't find weather data for Atlantis. The city doesn't exist in our database.</Assistant>
    </>
  )
}
```

## Multi-line Content

Content is automatically trimmed. Use template literals or explicit newlines:

```tsx
function Guidelines() {
  return <System>You are a helpful assistant. Guidelines: - Be concise - Provide examples - Ask clarifying questions</System>
}

const messages = prompt(<Guidelines />)
```

## Combining Messages

Use fragments to combine multiple messages:

```tsx
function Conversation() {
  return (
    <>
      <System>You are a helpful assistant.</System>
      <User>Hello!</User>
      <Assistant>Hi! How can I help you today?</Assistant>
      <User>I need help with TypeScript.</User>
    </>
  )
}

const messages = prompt(<Conversation />)
```

## Dynamic Content

Interpolate variables and expressions:

```tsx
interface ConversationProps {
  userName: string
  context: string
  previousMessages: { role: "user" | "assistant"; text: string }[]
}

function DynamicConversation({ userName, context, previousMessages }: ConversationProps) {
  return (
    <>
      <System>
        You are helping {userName} learn about {context}.
      </System>
      {previousMessages.map((msg, i) => (msg.role === "user" ? <User key={i}>{msg.text}</User> : <Assistant key={i}>{msg.text}</Assistant>))}
      <User>Can you give me an example?</User>
    </>
  )
}

const messages = prompt(
  <DynamicConversation
    userName="Alice"
    context="TypeScript generics"
    previousMessages={[
      { role: "user", text: "What are generics?" },
      { role: "assistant", text: "Generics are..." },
    ]}
  />,
)
```

## Advanced Components

### WrapUser

Combines new content with existing user messages from a conversation history. Useful for adding context, instructions, or formatting requirements to ongoing conversations without modifying the original messages.

```tsx
import { WrapUser, prompt } from "@gumbee/prompt/openai"

const existingMessages = [{ role: "user", content: "What's the capital of France?" }]

const messages = prompt(<WrapUser>Please respond in JSON format.</WrapUser>, { messages: existingMessages })
// Result: The last user message is wrapped and combined with new content
// [{ role: 'user', content: '<user>\nWhat\'s the capital of France?\n</user>\n\nPlease respond in JSON format.' }]
```

**How it works:**

1. Finds the last user message from the provided `messages` option
2. Wraps the original content in XML-style tags (default: `<user>...</user>`)
3. Combines with the new content based on the mode (suffix/prefix)

**Props:**

| Prop       | Type                   | Default    | Description                                                                          |
| :--------- | :--------------------- | :--------- | :----------------------------------------------------------------------------------- |
| `tag`      | `string`               | `"user"`   | XML tag name for wrapping original content                                           |
| `mode`     | `"prefix" \| "suffix"` | `"suffix"` | Position of new content relative to original                                         |
| `children` | `PromptNode`           | -          | New content to add (can include conditional functions `({ hasUser }) => PromptNode`) |

**Suffix Mode (default):**

New content appears after the wrapped original:

```tsx
const messages = prompt(<WrapUser tag="original-query">Please respond in JSON format.</WrapUser>, {
  messages: [{ role: "user", content: "What's 2+2?" }],
})
// Content: "<original-query>\nWhat's 2+2?\n</original-query>\n\nPlease respond in JSON format."
```

**Prefix Mode:**

New content appears before the wrapped original:

```tsx
const messages = prompt(
  <WrapUser mode="prefix" tag="context">
    Here is some context for the following question:
  </WrapUser>,
  { messages: [{ role: "user", content: "What's 2+2?" }] },
)
// Content: "Here is some context for the following question:\n\n<context>\nWhat's 2+2?\n</context>"
```

**Multiple WrapUser Components:**

Combine multiple WrapUser components with different modes:

```tsx
const messages = prompt(
  [
    <WrapUser mode="prefix" tag="context">
      System context information
    </WrapUser>,
    <WrapUser mode="suffix" tag="user">
      Please format as JSON
    </WrapUser>,
  ],
  { messages: existingMessages },
)
// Prefixes come first, then wrapped original, then suffixes
```

**Without `messages` Option:**

When used without the `messages` option, WrapUser renders as a regular user message:

```tsx
const messages = prompt(<WrapUser>Just content</WrapUser>)
// [{ role: 'user', content: 'Just content' }]
```

**Conditional Rendering:**

WrapUser supports conditional function children that receive a context object with `hasUser`, allowing you to render different content based on whether a user message exists:

```tsx
const existingMessages = [{ role: "user", content: "Describe this image" }]

const messages = prompt(
  <WrapUser>
    Respond with a JSON object.
    {({ hasUser }) => (hasUser ? " Reply to the user's request above." : " No user context provided.")}
  </WrapUser>,
  { messages: existingMessages },
)
// When hasUser=true: "Respond with a JSON object. Reply to the user's request above."
// When hasUser=false: "Respond with a JSON object. No user context provided."
```

The `hasUser` parameter is:

- `true` when `messages` option contains a user message
- `false` when there's no user message or no `messages` option

**Conditional JSX and File Components:**

Conditional functions can return JSX components, including File components for multipart messages:

```tsx
const messages = prompt(
  <WrapUser>
    {({ hasUser }) =>
      hasUser ? (
        <Group tag="context">See the user's request above.</Group>
      ) : (
        <>
          Here's the image to analyze:
          <File base64={imageData} mimeType="image/png" />
        </>
      )
    }
  </WrapUser>,
  { messages: existingMessages },
)
```

**Combining Static and Conditional Content:**

Mix static children with conditional functions:

```tsx
const messages = prompt(
  <WrapUser>
    Please respond in JSON format.
    <Linebreak repeat={2} />
    <Group tag="guidelines">
      <List>
        <Item>Be concise</Item>
        <Item>Use proper formatting</Item>
      </List>
    </Group>
    {({ hasUser }) => (hasUser ? "\n\nThe user's original request is shown above in the <user> tag." : null)}
  </WrapUser>,
  { messages: existingMessages },
)
```

**Use Cases:**

- Adding output format requirements to existing queries
- Injecting context before user questions
- Augmenting prompts in middleware or interceptors
- Building prompt enhancement pipelines
- Conditional context based on conversation state
- Adding images/files conditionally based on user presence

### Native

Passes pre-formatted SDK-native content directly through to the adapter without transformation. Useful when you have content already in the target SDK's format or need to use SDK-specific features not covered by JSX components.

```tsx
import { User, Native, prompt } from "@gumbee/prompt/openai"

const messages = prompt([
  <User>Regular JSX message</User>,
  <Native
    content={{
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_123",
          type: "function",
          function: {
            name: "custom_tool",
            arguments: '{"key": "value"}',
          },
        },
      ],
    }}
  />,
])
```

**Props:**

| Prop      | Type      | Description                                   |
| :-------- | :-------- | :-------------------------------------------- |
| `content` | `unknown` | Native SDK content to pass through (required) |

**OpenAI Example:**

```tsx
import { User, Native, prompt } from "@gumbee/prompt/openai"

function ConversationWithNative() {
  return (
    <>
      <User>Hello!</User>
      <Native
        content={{
          role: "assistant",
          content: "Hi! How can I help you today?",
        }}
      />
      <User>What's the weather?</User>
    </>
  )
}

const messages = prompt(<ConversationWithNative />)
```

**Anthropic Example:**

```tsx
import { User, Native, prompt } from "@gumbee/prompt/anthropic"

function AnthropicWithNative() {
  return (
    <>
      <User>Analyze this image</User>
      <Native
        content={{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "url",
                url: "https://example.com/image.png",
              },
            },
          ],
        }}
      />
    </>
  )
}

const { messages } = prompt(<AnthropicWithNative />)
```

**AI SDK Example:**

```tsx
import { User, Native, prompt } from "@gumbee/prompt/ai-sdk"

function AISDKWithNative() {
  return (
    <>
      <User>Regular message</User>
      <Native
        content={{
          role: "assistant",
          content: [
            { type: "text", text: "Here's the result:" },
            { type: "tool-call", toolCallId: "call_1", toolName: "search", input: { query: "test" } },
          ],
        }}
      />
    </>
  )
}

const messages = prompt(<AISDKWithNative />)
```

**Use Cases:**

- Injecting messages from external sources already in SDK format
- Using SDK-specific features not yet supported by JSX components
- Migrating existing code incrementally to JSX
- Debugging by inserting raw message payloads
- Working with cached or stored conversation histories

**Warning:** Native content bypasses all JSX processing. Ensure the content matches the target SDK's expected format exactly.

## Type Exports

```tsx
import type { MessageProps, ToolResultProps, ToolCallProps, WrapUserProps, WrapUserCondition, WrapUserContext, NativeProps } from "@gumbee/prompt"

// MessageProps - Base props for System, User, Assistant
interface MessageProps {
  children?: PromptNode
}

// ToolResultProps - Props for ToolResult component
interface ToolResultProps extends MessageProps {
  id: string // Required - the tool call ID this result corresponds to
  name?: string // Optional - some SDKs require it (AI SDK)
  json?: unknown // Structured JSON result (preferred for structured data)
  isError?: boolean // Whether this result represents an error
}

// ToolCallProps - Props for ToolCall component
interface ToolCallProps {
  id: string // Unique identifier for this tool call
  name: string // Name of the tool being called
  input: Record<string, unknown> // Arguments passed to the tool
}

// WrapUserProps - Props for WrapUser component
interface WrapUserProps {
  tag?: string // XML tag for wrapping original content (default: "user")
  mode?: "prefix" | "suffix" // Position of new content (default: "suffix")
  children?: PromptNode // New content to add (can include conditional functions)
}

// WrapUserContext - Context object passed to conditional functions
interface WrapUserContext {
  hasUser: boolean // Whether there's an existing user message
}

// WrapUserCondition - Conditional render function for WrapUser
type WrapUserCondition = (context: WrapUserContext) => PromptNode

// NativeProps - Props for Native component
interface NativeProps {
  content: unknown // Native SDK content to pass through
}
```
