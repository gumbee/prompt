# @gumbee/prompt

<div align="left">

[![npm version](https://img.shields.io/npm/v/@gumbee/prompt.svg)](https://www.npmjs.com/package/@gumbee/prompt)
[![License](https://img.shields.io/npm/l/@gumbee/prompt.svg)](package.json)

</div>

@gumbee/prompt is a JSX-based prompt builder for LLMs. It provides a declarative, type-safe way to construct prompts using familiar JSX syntax with built-in adapters for OpenAI, Vercel AI SDK, and Anthropic.

While this package is intended for internal use within the Gumbee ecosystem, it is published publicly and can be used in other projects if found useful.

## Installation

```bash
bun add @gumbee/prompt
# npm install @gumbee/prompt
# pnpm add @gumbee/prompt
# yarn add @gumbee/prompt
```

Install your preferred SDK as a peer dependency:

```bash
# For OpenAI
bun add openai

# For Vercel AI SDK
bun add ai

# For Anthropic
bun add @anthropic-ai/sdk
```

## Setup

### Standalone Projects

For projects that don't use React, Svelte, or other JSX frameworks, add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@gumbee/prompt"
  }
}
```

### Projects with React, Svelte, or Other JSX Frameworks

If your project already uses JSX (React, Svelte, etc.), use the **per-file pragma** to avoid conflicts. Add `/** @jsxImportSource @gumbee/prompt */` at the top of files that define prompts:

```tsx
// prompts/chat.tsx
/** @jsxImportSource @gumbee/prompt */

import { System, User } from "@gumbee/prompt"

export function AgentPrompt({ userName, question }: { userName: string; question: string }) {
  return (
    <>
      <System>You are a helpful coding assistant.</System>
      <User>
        Hi, I'm {userName}. {question}
      </User>
    </>
  )
}
```

```ts
// backend/agent.ts
import { prompt } from '@gumbee/prompt/openai'
import { AgentPrompt } from '../prompts/chat'
import OpenAI from 'openai'

const client = new OpenAI()

export async function askQuestion(userName: string, question: string) {
  const messages = prompt(<AgentPrompt userName={userName} question={question} />)

  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages,
  })

  return response.choices[0].message.content
}
```

The pragma only affects the file it's in, so your React/Svelte components continue to work normally.

## Quick Start

Define your prompts as reusable components:

```tsx
// prompts/assistant.tsx
/** @jsxImportSource @gumbee/prompt */
import { System, User, If, Each } from "@gumbee/prompt"

interface AssistantPromptProps {
  userName: string
  items: string[]
}

export function AssistantPrompt({ userName, items }: AssistantPromptProps) {
  return (
    <>
      <System>You are a helpful coding assistant.</System>
      <User>
        Hi, I'm {userName}!
        <If condition={items.length > 0}>
          {"\n"}I'm interested in:
          <Each items={items}>{(item) => `\n- ${item}`}</Each>
        </If>
      </User>
    </>
  )
}
```

Then convert to your provider's format in the backend:

```ts
// backend/chat.ts
import { prompt } from '@gumbee/prompt/openai'
import { AssistantPrompt } from '../prompts/assistant'

const messages = prompt(
  <AssistantPrompt userName="Alice" items={['TypeScript', 'React', 'Node.js']} />
)

// Result:
// [
//   { role: 'system', content: 'You are a helpful coding assistant.' },
//   { role: 'user', content: "Hi, I'm Alice!\nI'm interested in:\n- TypeScript\n- React\n- Node.js" }
// ]
```

## Documentation

- [JSX Setup](docs/JSX.md) - Configure your project for JSX prompt building
- [Components](docs/COMPONENTS.md) - Message components: `System`, `User`, `Assistant`, `ToolResult`, `ToolCall`
- [Control Flow](docs/CONTROL-FLOW.md) - Conditional and iteration: `If`, `Show`, `Each`, `Linebreak`
- [Data Helpers](docs/DATA.md) - Data components: `Json`, `File`
- [Markdown](docs/MARKDOWN.md) - Formatting helpers: `List`, `Heading`, `Code`, `Bold`, `Quote`
- [Adapters](docs/ADAPTERS.md) - SDK-specific adapters for OpenAI, AI SDK, and Anthropic

## Entry Points

Each adapter is a standalone entry point. Import from the one matching your SDK:

| Entry Point                | SDK           | Output Format                  |
| :------------------------- | :------------ | :----------------------------- |
| `@gumbee/prompt/openai`    | OpenAI SDK    | `ChatCompletionMessageParam[]` |
| `@gumbee/prompt/ai-sdk`    | Vercel AI SDK | `CoreMessage[]`                |
| `@gumbee/prompt/anthropic` | Anthropic SDK | `{ system, messages }`         |

Each entry point exports:

- `prompt()` - Convert JSX to SDK-specific message format
- Message components: `System`, `User`, `Assistant`, `ToolResult`, `ToolCall`
- Control flow: `If`, `Show`, `Each`, `Linebreak`, `Fragment`
- Data helpers: `Json`, `File`
- Markdown: `List`, `Item`, `Heading`, `Code`, `Bold`, `Italic`, `Strike`, `Quote`, `Hr`

## Why JSX for Prompts?

- **Type Safety** - Full TypeScript support with autocomplete
- **Composability** - Build reusable prompt components
- **Readability** - Familiar syntax for complex prompts
- **Control Flow** - Native conditionals and loops without string concatenation
- **Multi-SDK** - Same prompts work across different LLM providers

## Development

For build information, check the `package.json` scripts.
This package is part of the Gumbee ecosystem of packages used by myself to build various personal projects and ideas.

To report bugs or submit patches please use [GitHub issues](https://github.com/gumbee/prompt/issues).

## Releasing

This package uses [changesets](https://github.com/changesets/changesets) for version management and GitHub Actions for automated publishing.

### Creating a Changeset

When you make changes that should be released, create a changeset:

```bash
bun changeset
```

This will prompt you to:

1. Select the type of change (patch, minor, major)
2. Write a summary of the changes

Commit the generated changeset file (in `.changeset/`) with your changes.

### Publishing a Release

When ready to release:

```bash
# 1. Apply changesets to bump version and update CHANGELOG
bun run version

# 2. Commit the version bump
git add .
git commit -m "chore: release v1.x.x"

# 3. Create and push the tag
git tag v1.x.x
git push origin main --tags
```

The GitHub Actions workflow will automatically build, test, and publish to npm when the tag is pushed.
