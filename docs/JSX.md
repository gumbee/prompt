# JSX Setup

Configure your project to use JSX for prompt building.

## Standalone Projects

For projects that don't use React, Svelte, or other JSX frameworks, add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@gumbee/prompt"
  }
}
```

This enables JSX syntax and tells TypeScript to use `@gumbee/prompt`'s JSX runtime.

## Projects with React, Svelte, or Other JSX Frameworks

If your project already uses JSX for UI components, setting `jsxImportSource` globally would conflict with your framework. Instead, use the **per-file pragma** at the top of files that define prompts:

```tsx
// prompts/assistant.tsx
/** @jsxImportSource @gumbee/prompt */

import { System, User } from "@gumbee/prompt"

export function AssistantPrompt({ context }: { context: string }) {
  return (
    <>
      <System>You are a helpful assistant. Context: {context}</System>
      <User>Help me with my task.</User>
    </>
  )
}
```

Then import and use with `prompt()` in your backend:

```tsx
// backend/chat.ts
import { prompt } from "@gumbee/prompt/openai"
import { AssistantPrompt } from "../prompts/assistant"

const messages = prompt(<AssistantPrompt context="TypeScript project" />)
```

The pragma only affects the file it's in. Your React/Svelte components continue to work normally:

```tsx
// components/App.tsx - No pragma needed, uses React JSX
import { useState } from "react"

export function App() {
  // React JSX works as expected
  return <div>My App</div>
}
```

## Usage

Once configured (either via tsconfig or per-file pragma), you can use JSX syntax in `.tsx` files:

```tsx
/** @jsxImportSource @gumbee/prompt */
import { System, User, prompt } from "@gumbee/prompt/openai"

function SimplePrompt() {
  return (
    <>
      <System>You are a helpful assistant.</System>
      <User>Hello!</User>
    </>
  )
}

const messages = prompt(<SimplePrompt />)
```

## File Extensions

- Use `.tsx` for files containing JSX syntax
- Use `.ts` for files without JSX

## JSX Runtime

The package provides both production and development JSX runtimes:

| Export                        | Purpose                             |
| :---------------------------- | :---------------------------------- |
| `@gumbee/prompt/jsx-runtime`     | Production builds                   |
| `@gumbee/prompt/jsx-dev-runtime` | Development builds with source info |

These are automatically selected by your bundler based on the build mode.

## Fragment

Use fragments to group multiple message components in your prompt components:

```tsx
import { System, User, prompt } from "@gumbee/prompt/openai"

function SimplePrompt() {
  return (
    <>
      <System>System prompt here.</System>
      <User>User message here.</User>
    </>
  )
}

const messages = prompt(<SimplePrompt />)
```

Fragments are also useful for grouping within control flow:

```tsx
import { User, If, prompt } from "@gumbee/prompt/openai"

function ConditionalPrompt({ showMore }: { showMore: boolean }) {
  return (
    <User>
      Hello!
      <If condition={showMore}>
        <>Additional line 1. Additional line 2.</>
      </If>
    </User>
  )
}

const messages = prompt(<ConditionalPrompt showMore={true} />)
```

## Variable Interpolation

Use standard JSX expressions for dynamic content:

```tsx
function DynamicPrompt({ name, items }: { name: string; items: string[] }) {
  return (
    <User>
      Hello, my name is {name}. I have {items.length} items.
    </User>
  )
}

const messages = prompt(<DynamicPrompt name="Alice" items={["a", "b", "c"]} />)
```

## Custom Components

Create reusable prompt components:

```tsx
interface GreetingProps {
  name: string
  role: string
}

function Greeting({ name, role }: GreetingProps) {
  return (
    <System>
      You are {role}. The user's name is {name}. Be helpful and friendly.
    </System>
  )
}

function CodingAssistant({ userName }: { userName: string }) {
  return (
    <>
      <Greeting name={userName} role="a coding assistant" />
      <User>Help me write a function.</User>
    </>
  )
}

const messages = prompt(<CodingAssistant userName="Alice" />)
```

## Bundler Configuration

Most modern bundlers (Vite, esbuild, webpack 5+) automatically handle JSX transformation when `tsconfig.json` is configured. No additional bundler configuration is typically required.

### Vite

Vite reads `tsconfig.json` automatically. No extra config needed.

### esbuild

```js
esbuild.build({
  // esbuild reads tsconfig.json by default
  // or configure explicitly:
  jsx: "automatic",
  jsxImportSource: "@gumbee/prompt",
})
```

### Bun

Bun reads `tsconfig.json` automatically. No extra config needed.
