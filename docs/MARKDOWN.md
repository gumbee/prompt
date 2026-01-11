# Markdown

Helper components for common markdown formatting patterns.

## List

Create bulleted or numbered lists.

```tsx
import { System, List, Item, prompt } from "@gumbee/prompt/openai"

function Guidelines() {
  return (
    <System>
      Follow these guidelines:
      <List>
        <Item>Be concise</Item>
        <Item>Provide examples</Item>
        <Item>Ask clarifying questions</Item>
      </List>
    </System>
  )
}

const messages = prompt(<Guidelines />)
// "Follow these guidelines:\n- Be concise\n- Provide examples\n- Ask clarifying questions"
```

**Numbered Lists:**

```tsx
<List ordered>
  <Item>First, analyze the problem</Item>
  <Item>Then, propose a solution</Item>
  <Item>Finally, implement it</Item>
</List>
// "1. First, analyze the problem\n2. Then, propose a solution\n3. Finally, implement it"
```

**Custom Bullets:**

```tsx
<List bullet="•">
  <Item>Custom bullet point</Item>
  <Item>Another point</Item>
</List>
// "• Custom bullet point\n• Another point"
```

**Props:**

| Prop       | Type           | Description                            |
| :--------- | :------------- | :------------------------------------- |
| `ordered`  | `boolean`      | Use numbered list (1. 2. 3.)           |
| `bullet`   | `string`       | Custom bullet character (default: "-") |
| `children` | `PromptNode[]` | List items                             |

## Heading

Create markdown headings.

```tsx
import { System, Heading, prompt } from "@gumbee/prompt/openai"

function FormattedInstructions() {
  return (
    <System>
      <Heading>Instructions</Heading>
      You are a helpful assistant.
      <Heading level={3}>Response Format</Heading>
      Always respond in JSON.
    </System>
  )
}

const messages = prompt(<FormattedInstructions />)
// "## Instructions\nYou are a helpful assistant.\n\n### Response Format\nAlways respond in JSON."
```

**Props:**

| Prop       | Type         | Description                |
| :--------- | :----------- | :------------------------- |
| `level`    | `1-6`        | Heading level (default: 2) |
| `children` | `PromptNode` | Heading text               |

## Code

Create inline code or code blocks.

````tsx
import { User, Code, prompt } from "@gumbee/prompt/openai"

// Inline code
function InlineCodeExample() {
  return (
    <User>
      How do I use the <Code inline>map</Code> function?
    </User>
  )
}

const messages = prompt(<InlineCodeExample />)
// "How do I use the `map` function?"

// Code block
function CodeBlockExample({ code }: { code: string }) {
  return (
    <User>
      Fix this code:
      <Code lang="typescript">{code}</Code>
    </User>
  )
}

const messages2 = prompt(<CodeBlockExample code="const x: string = 123;" />)
// "Fix this code:\n```typescript\nconst x: string = 123;\n```"
````

**Props:**

| Prop       | Type         | Description                      |
| :--------- | :----------- | :------------------------------- |
| `inline`   | `boolean`    | Use inline code (backticks)      |
| `lang`     | `string`     | Language for syntax highlighting |
| `children` | `PromptNode` | Code content                     |

## Text Formatting

### Bold

```tsx
import { User, Bold, prompt } from "@gumbee/prompt/openai"

function BoldExample() {
  return (
    <User>
      This is <Bold>very important</Bold>.
    </User>
  )
}

const messages = prompt(<BoldExample />)
// "This is **very important**."
```

### Italic

```tsx
import { User, Italic, prompt } from "@gumbee/prompt/openai"

function ItalicExample() {
  return (
    <User>
      This is <Italic>emphasized</Italic>.
    </User>
  )
}

const messages = prompt(<ItalicExample />)
// "This is *emphasized*."
```

### Strike

```tsx
import { User, Strike, prompt } from "@gumbee/prompt/openai"

function StrikeExample() {
  return (
    <User>
      This is <Strike>deleted</Strike>.
    </User>
  )
}

const messages = prompt(<StrikeExample />)
// "This is ~~deleted~~."
```

## Quote

Create blockquotes.

```tsx
import { User, Quote, prompt } from "@gumbee/prompt/openai"

function QuoteExample() {
  return (
    <User>
      As the documentation states:
      <Quote>All components return strings that are concatenated into the final message.</Quote>
    </User>
  )
}

const messages = prompt(<QuoteExample />)
// "As the documentation states:\n> All components return strings..."
```

Multi-line quotes are properly prefixed:

```tsx
<Quote>Line one. Line two.</Quote>
// "> Line one.\n> Line two."
```

## Hr (Horizontal Rule)

Create a horizontal rule separator.

```tsx
import { System, Hr, prompt } from "@gumbee/prompt/openai"

function SectionedContent() {
  return (
    <System>
      Section one content.
      <Hr />
      Section two content.
    </System>
  )
}

const messages = prompt(<SectionedContent />)
// "Section one content.\n---\nSection two content."
```

## Combining Components

Markdown components work well together:

```tsx
import { System, Heading, List, Item, Code, Bold, Linebreak, prompt } from '@gumbee/prompt/openai'

function CodeReviewGuidelines() {
  return (
    <System>
      <Heading>Code Review Guidelines</Heading>
      <Linebreak />
      <List>
        <Item><Bold>Clarity</Bold> - Code should be self-documenting</Item>
        <Item><Bold>Performance</Bold> - Avoid unnecessary allocations</Item>
        <Item><Bold>Types</Bold> - Use strict TypeScript</Item>
      </List>
      <Linebreak repeat={2} />
      <Heading level={3}>Example</Heading>
      <Linebreak />
      <Code lang="typescript">
        function greet(name: string): string {
          return `Hello, ${name}!`;
        }
      </Code>
    </System>
  )
}

const messages = prompt(<CodeReviewGuidelines />)
```

## Type Exports

```tsx
import type { ListProps, ItemProps, HeadingProps, CodeProps, TextProps } from "@gumbee/prompt"

interface ListProps {
  ordered?: boolean
  bullet?: string
  children: PromptNode[]
}

interface ItemProps {
  children?: PromptNode
}

interface HeadingProps {
  level?: 1 | 2 | 3 | 4 | 5 | 6
  children?: PromptNode
}

interface CodeProps {
  lang?: string
  inline?: boolean
  children?: PromptNode
}

// Used by Bold, Italic, Strike, Quote
interface TextProps {
  children?: PromptNode
}
```
