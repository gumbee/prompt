import type { PromptNode } from "../types"
import { isElement } from "../element"

/**
 * Markdown helper components for cleaner prompt formatting
 */

// ============================================================================
// List Components
// ============================================================================

export interface ListProps {
  /** Use numbered list instead of bullets */
  ordered?: boolean
  /** Custom bullet character (default: "-") */
  bullet?: string
  /** List items */
  children: PromptNode[] | PromptNode
}

/**
 * Create a markdown list (block element - includes trailing newline)
 *
 * @example
 * <List>
 *   <Item>First item</Item>
 *   <Item>Second item</Item>
 * </List>
 * // - First item
 * // - Second item
 *
 * @example
 * <List ordered>
 *   <Item>Step one</Item>
 *   <Item>Step two</Item>
 * </List>
 * // 1. Step one
 * // 2. Step two
 */
export function List(props: ListProps): string {
  const arrified = Array.isArray(props.children) ? props.children : [props.children]
  const items = flattenChildren(arrified)
  const bullet = props.bullet ?? "-"

  const content = items
    .map((item, index) => {
      const prefix = props.ordered ? `${index + 1}.` : bullet
      return `${prefix} ${stringify(item)}`
    })
    .join("\n")

  return `${content}\n`
}

export interface ItemProps {
  children?: PromptNode
}

/**
 * A list item - use inside `<List>` components
 */
export function Item(props: ItemProps): string {
  return stringify(props.children)
}

// ============================================================================
// Heading Component
// ============================================================================

export interface HeadingProps {
  /** Heading level 1-6 (default: 2) */
  level?: 1 | 2 | 3 | 4 | 5 | 6
  children?: PromptNode
}

/**
 * Create a markdown heading (block element - includes trailing newline)
 *
 * @example
 * <Heading>Section Title</Heading>
 * // "## Section Title\n"
 *
 * <Heading level={3}>Subsection</Heading>
 * // "### Subsection\n"
 */
export function Heading(props: HeadingProps): string {
  const level = props.level ?? 2
  const hashes = "#".repeat(level)
  return `${hashes} ${stringify(props.children)}\n`
}

// ============================================================================
// Code Component
// ============================================================================

export interface CodeProps {
  /** Language for syntax highlighting (creates code block) */
  lang?: string
  /** Use inline code instead of block */
  inline?: boolean
  children?: PromptNode
}

/**
 * Create inline code or code blocks (block mode includes trailing newline)
 *
 * @example
 * <Code inline>myFunction()</Code>
 * // `myFunction()`
 *
 * @example
 * <Code lang="typescript">
 *   const x: number = 42;
 * </Code>
 * // ```typescript
 * // const x: number = 42;
 * // ```
 */
export function Code(props: CodeProps): string {
  const content = stringify(props.children)

  if (props.inline) {
    return `\`${content}\``
  }

  const lang = props.lang ?? ""
  return `\`\`\`${lang}\n${content}\n\`\`\`\n`
}

// ============================================================================
// Text Formatting Components
// ============================================================================

export interface TextProps {
  children?: PromptNode
}

/**
 * Bold text
 *
 * @example
 * <Bold>important</Bold>
 * // **important**
 */
export function Bold(props: TextProps): string {
  return `**${stringify(props.children)}**`
}

/**
 * Italic text
 *
 * @example
 * <Italic>emphasis</Italic>
 * // *emphasis*
 */
export function Italic(props: TextProps): string {
  return `*${stringify(props.children)}*`
}

/**
 * Strikethrough text
 *
 * @example
 * <Strike>deleted</Strike>
 * // ~~deleted~~
 */
export function Strike(props: TextProps): string {
  return `~~${stringify(props.children)}~~`
}

// ============================================================================
// Block Components
// ============================================================================

/**
 * Blockquote (block element - includes trailing newline)
 *
 * @example
 * <Quote>This is a quote</Quote>
 * // > This is a quote
 */
export function Quote(props: TextProps): string {
  const content = stringify(props.children)
  // Handle multi-line quotes
  const quoted = content
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")

  return `${quoted}\n`
}

/**
 * Horizontal rule (block element - includes trailing newline)
 *
 * @example
 * <Hr />
 * // ---
 */
export function Hr(): string {
  return "---\n"
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Convert PromptNode to string
 */
function stringify(node: PromptNode): string {
  if (node === null || node === undefined) {
    return ""
  }
  if (typeof node === "string") {
    return node
  }
  if (typeof node === "number") {
    return String(node)
  }
  if (typeof node === "boolean") {
    return ""
  }
  if (Array.isArray(node)) {
    return node.map(stringify).join("")
  }
  // For elements, try to get string content
  if (isElement(node)) {
    // Handle function components
    if (typeof node.type === "function") {
      const result = node.type({ ...node.props, children: node.children })
      return stringify(result)
    }
    return node.children.map(stringify).join("")
  }
  return String(node)
}

/**
 * Flatten children array, filtering nulls
 */
function flattenChildren(children: PromptNode[]): PromptNode[] {
  const result: PromptNode[] = []

  for (const child of children) {
    if (child === null || child === undefined || typeof child === "boolean") {
      continue
    }
    if (Array.isArray(child)) {
      result.push(...flattenChildren(child))
    } else {
      result.push(child)
    }
  }

  return result
}
