# Control Flow

Conditional and iteration components for dynamic prompt building.

## If

Renders children only when the condition is true.

```tsx
import { System, User, If, Linebreak, prompt } from "@gumbee/prompt/openai"

function Greeting({ userName, isVIP }: { userName: string; isVIP: boolean }) {
  return (
    <>
      <System>You are a helpful assistant.</System>
      <User>
        Hello, I'm {userName}.
        <If condition={isVIP}>
          <Linebreak />
          I'm a VIP member with priority support.
        </If>
      </User>
    </>
  )
}

const messages = prompt(<Greeting userName="Alice" isVIP={true} />)
```

**Props:**

| Prop        | Type         | Description                     |
| :---------- | :----------- | :------------------------------ |
| `condition` | `boolean`    | When true, renders children     |
| `children`  | `PromptNode` | Content to render conditionally |

## Show

Renders children when condition is true, with optional fallback content.

```tsx
import { User, Show, prompt } from "@gumbee/prompt/openai"

function LoginMessage({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <User>
      <Show when={isLoggedIn} fallback="Please log in to continue.">
        Welcome back! How can I help you today?
      </Show>
    </User>
  )
}

const messages = prompt(<LoginMessage isLoggedIn={false} />)
```

**Props:**

| Prop       | Type         | Description                                             |
| :--------- | :----------- | :------------------------------------------------------ |
| `when`     | `boolean`    | When true, renders children; otherwise renders fallback |
| `fallback` | `PromptNode` | Content to render when `when` is false                  |
| `children` | `PromptNode` | Content to render when `when` is true                   |

## Each

Iterates over an array and renders content for each item.

```tsx
import { System, User, Each, prompt } from "@gumbee/prompt/openai"

function SkillsList({ skills }: { skills: string[] }) {
  return (
    <>
      <System>You are a coding assistant.</System>
      <User>
        I know the following technologies:
        <Each items={skills}>{(skill, index) => `\n${index + 1}. ${skill}`}</Each>
      </User>
    </>
  )
}

const messages = prompt(<SkillsList skills={["TypeScript", "React", "Node.js"]} />)
// User content: "I know the following technologies:\n1. TypeScript\n2. React\n3. Node.js"
```

**Props:**

| Prop       | Type                                     | Description                          |
| :--------- | :--------------------------------------- | :----------------------------------- |
| `items`    | `T[]`                                    | Array to iterate over                |
| `children` | `(item: T, index: number) => PromptNode` | Render function called for each item |

### Complex Objects

```tsx
interface Task {
  id: string
  title: string
  priority: "high" | "medium" | "low"
}

function TaskList({ tasks }: { tasks: Task[] }) {
  return (
    <User>
      Here are my current tasks:
      <Each items={tasks}>{(task) => `\n- [${task.priority.toUpperCase()}] ${task.title}`}</Each>
    </User>
  )
}

const messages = prompt(
  <TaskList
    tasks={[
      { id: "1", title: "Fix login bug", priority: "high" },
      { id: "2", title: "Update docs", priority: "medium" },
    ]}
  />,
)
```

## Linebreak

Insert line breaks without ugly `{'\n'}` interpolation.

```tsx
import { System, User, Linebreak, prompt } from "@gumbee/prompt/openai"

function AssistantWithGuidelines() {
  return (
    <>
      <System>
        You are a helpful assistant.
        <Linebreak repeat={2} />
        Guidelines:
        <Linebreak />
        - Be concise
        <Linebreak />- Provide examples
      </System>
      <User>Hello!</User>
    </>
  )
}

const messages = prompt(<AssistantWithGuidelines />)
// System content: "You are a helpful assistant.\n\nGuidelines:\n- Be concise\n- Provide examples"
```

**Props:**

| Prop     | Type     | Description                                  |
| :------- | :------- | :------------------------------------------- |
| `repeat` | `number` | Number of line breaks to insert (default: 1) |

**Why is this needed?**

JSX collapses whitespace by default (inherited from HTML/React behavior). Line breaks in your source code become spaces:

```tsx
// This becomes "Line 1 Line 2" (no newline)
<User>
  Line 1
  Line 2
</User>

// Use Linebreak to preserve formatting
<User>
  Line 1
  <Linebreak />
  Line 2
</User>
// "Line 1\nLine 2"
```

## Nesting Control Flow

Control flow components can be nested:

```tsx
interface Category {
  name: string
  items: string[]
}

function TechStack({ categories }: { categories: Category[] }) {
  return (
    <User>
      My tech stack:
      <Each items={categories}>
        {(category) => (
          <>
            {`\n\n${category.name}:`}
            <If condition={category.items.length > 0}>
              <Each items={category.items}>{(item) => `\n  - ${item}`}</Each>
            </If>
          </>
        )}
      </Each>
    </User>
  )
}

const messages = prompt(
  <TechStack
    categories={[
      { name: "Frontend", items: ["React", "Vue", "Svelte"] },
      { name: "Backend", items: ["Node.js", "Python", "Go"] },
    ]}
  />,
)
```

## Combining with Message Components

Control flow works inside any message component:

```tsx
interface ProjectContext {
  hasContext: boolean
  context: string
  constraints: string[]
}

function EngineerPrompt({ hasContext, context, constraints }: ProjectContext) {
  return (
    <>
      <System>
        You are a senior software engineer.
        <If condition={hasContext}>
          <Linebreak repeat={2} />
          Current project context: {context}
        </If>
        <Show when={constraints.length > 0} fallback="">
          <Linebreak repeat={2} />
          Constraints:
          <Each items={constraints}>
            {(c) => (
              <>
                <Linebreak />- {c}
              </>
            )}
          </Each>
        </Show>
      </System>
      <User>How should I structure my code?</User>
    </>
  )
}

const messages = prompt(
  <EngineerPrompt hasContext={true} context="Building a REST API" constraints={["Must use TypeScript", "No external dependencies"]} />,
)
```

## Type Exports

```tsx
import type { IfProps, ShowProps, EachProps, LinebreakProps } from "@gumbee/prompt"

interface IfProps {
  condition: boolean
  children?: PromptNode
}

interface ShowProps {
  when: boolean
  fallback?: PromptNode
  children?: PromptNode
}

interface EachProps<T> {
  items: T[]
  children: (item: T, index: number) => PromptNode
}

interface LinebreakProps {
  repeat?: number // default: 1
}
```
