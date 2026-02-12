# @gumbee/prompt

<div align="left">

[![npm version](https://img.shields.io/npm/v/@gumbee/prompt.svg)](https://www.npmjs.com/package/@gumbee/prompt)
[![License](https://img.shields.io/npm/l/@gumbee/prompt.svg)](package.json)

</div>

A JSX-based prompt builder for LLMs with type-safe, composable prompt components and adapters for OpenAI, Vercel AI SDK, and Anthropic.

========================

<div align="left">
Related Documentation

[JSX Setup](docs/JSX.md) •
[Components](docs/COMPONENTS.md) •
[Control Flow](docs/CONTROL-FLOW.md) •
[Data Helpers](docs/DATA.md) •
[Markdown](docs/MARKDOWN.md) •
[Adapters](docs/ADAPTERS.md)

</div>

## Features

- **JSX Prompt Authoring** - Build prompts as reusable JSX components instead of string templates
- **Type-Safe Composition** - Full TypeScript support with autocomplete and typed prompt primitives
- **Control Flow Built In** - Conditionals and loops with `If`, `Show`, `Each`, and `Linebreak`
- **Rich Formatting Helpers** - Markdown and data helpers like `List`, `Code`, `Json`, and `File`
- **Multi-SDK Adapters** - Convert the same prompt tree to OpenAI, AI SDK, or Anthropic formats
- **Framework Friendly** - Works in standalone TypeScript projects and mixed JSX framework codebases

## Installation

1. Install `@gumbee/prompt`

   ```bash
   bun add @gumbee/prompt
   # npm install @gumbee/prompt
   # pnpm add @gumbee/prompt
   # yarn add @gumbee/prompt
   ```

2. Install the SDK peer dependency you plan to use

   ```bash
   # OpenAI adapter
   bun add openai

   # Vercel AI SDK adapter
   bun add ai

   # Anthropic adapter
   bun add @anthropic-ai/sdk
   ```

## Quick Start

For standalone TypeScript projects (without React/Svelte JSX), add this to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@gumbee/prompt"
  }
}
```

If your project already uses JSX (React/Svelte/etc.), keep your existing config and add per-file pragma only in prompt files:

```tsx
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

Then convert the JSX prompt to your provider message format:

```ts
// backend/chat.ts
import { prompt } from "@gumbee/prompt/openai"
import { AssistantPrompt } from "../prompts/assistant"

const messages = prompt(
  <AssistantPrompt userName="Alice" items={["TypeScript", "React", "Node.js"]} />
)

// Result:
// [
//   { role: "system", content: "You are a helpful coding assistant." },
//   { role: 'user', content: "Hi, I'm Alice!\nI'm interested in:\n- TypeScript\n- React\n- Node.js" }
// ]
```

The pragma only affects the file it's in, so your React/Svelte components continue to work normally.

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

## License

MIT
