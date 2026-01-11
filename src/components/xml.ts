/**
 * XML-related components for structured prompt formatting
 */

import { createElement } from "../element"
import type { PromptElement, PromptNode } from "../types"

/**
 * Internal type identifier for Group elements
 */
export const XML_TYPES = {
  GROUP: "llm:group",
} as const

// ============================================================================
// Group Component
// ============================================================================

export interface GroupProps {
  /** The XML tag name to wrap content with */
  tag: string
  /** Number of spaces to indent content (default: 2, ignored when inline) */
  indent?: number
  /** Render as inline element without newlines or indentation (default: false) */
  inline?: boolean
  /** Content to wrap */
  children?: PromptNode
}

/**
 * Wraps content in XML-style tags with proper indentation (block-level by default).
 * Children are processed normally by the renderer, then wrapped with tags.
 *
 * @example
 * <Group tag="schema">
 *   <Heading>Title</Heading>
 *   Some content
 * </Group>
 * // Produces:
 * // <schema>
 * //   ## Title
 * //   Some content
 * // </schema>
 *
 * @example
 * <Group tag="user" indent={4}>
 *   User content here
 * </Group>
 *
 * @example
 * <Group tag="name" inline>John Doe</Group>
 * // Produces: <name>John Doe</name>
 */
export function Group(props: GroupProps): PromptElement {
  return createElement(XML_TYPES.GROUP, { tag: props.tag, indent: props.indent ?? 2, inline: props.inline ?? false }, props.children)
}

/**
 * Check if a type is an XML component type
 */
export function isXmlType(type: string): boolean {
  return Object.values(XML_TYPES).includes(type as (typeof XML_TYPES)[keyof typeof XML_TYPES])
}

// ============================================================================
// String-based XML Helper (for non-JSX contexts)
// ============================================================================

export interface WrapXmlOptions {
  /** Number of spaces to indent content (default: 0 - no indentation) */
  indent?: number
}

/**
 * Wraps string content in XML-style tags.
 * Use this for non-JSX string building contexts.
 * For JSX composition, use the Group component instead.
 *
 * @example
 * wrapXml("schema", "type Output = { name: string }")
 * // <schema>
 * // type Output = { name: string }
 * // </schema>
 *
 * @example
 * wrapXml("user", "content", { indent: 2 })
 * // <user>
 * //   content
 * // </user>
 */
export function wrapXml(tag: string, content: string, options?: WrapXmlOptions): string {
  const indent = options?.indent ?? 0

  if (indent > 0) {
    const indentStr = " ".repeat(indent)
    const indentedContent = content
      .split("\n")
      .map((line) => (line ? indentStr + line : line))
      .join("\n")
    return `<${tag}>\n${indentedContent}\n</${tag}>`
  }

  return `<${tag}>\n${content}\n</${tag}>`
}
