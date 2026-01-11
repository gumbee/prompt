/**
 * Core types for the JSX prompt builder
 */

// Element types - using Symbol.for ensures global uniqueness at runtime
// Note: We intentionally use `symbol` (not `unique symbol`) here because bundlers
// create separate .d.ts files for each entry point, each with their own `unique symbol`
// declaration, causing TypeScript to treat them as incompatible types.
export const ELEMENT_TYPE: symbol = Symbol.for("gumbee.llm.element")

export type Role = "system" | "user" | "assistant" | "tool"

/**
 * Context object passed to WrapUser conditional functions
 */
export interface WrapUserContext {
  /** Whether there's an existing user message in the conversation */
  hasUser: boolean
}

/**
 * Conditional render function that receives WrapUser context.
 * Used within WrapUser component to conditionally render content.
 */
export type WrapUserConditionFn = (context: WrapUserContext) => PromptNodeBase

/**
 * Base Prompt node types (without conditional functions)
 */
export type PromptNodeBase = PromptElement | string | number | boolean | null | undefined | PromptNodeBase[]

/**
 * Full Prompt node type including conditional functions for WrapUser
 */
export type PromptNode = PromptNodeBase | WrapUserConditionFn | (PromptNodeBase | WrapUserConditionFn)[]

export interface PromptElement {
  $$typeof: typeof ELEMENT_TYPE
  type: string | ComponentFunction
  props: Record<string, unknown>
  children: PromptNode[]
}

export type ComponentFunction = (props: Record<string, unknown>) => PromptNode

// Props types for built-in components
export interface MessageProps {
  children?: PromptNode
}

export interface IfProps {
  condition: boolean
  children?: PromptNode
}

export interface ShowProps {
  when: boolean
  fallback?: PromptNode
  children?: PromptNode
}

export interface EachProps<T> {
  items: T[]
  children: (item: T, index: number) => PromptNode
}

// Tool call representation
export interface IRToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

// File/image part representation
export interface IRFilePart {
  type: "image" | "file"
  /** MIME type of the file */
  mimeType: string
  /** Base64-encoded data OR URL */
  data: string
  /** Whether data is a URL (vs base64) */
  isUrl?: boolean
  /** Optional filename */
  filename?: string
}

// Content can be text or file parts
export type IRContentPart = { type: "text"; text: string } | IRFilePart

// Intermediate representation for messages
export interface IRMessage {
  role: Role
  /** String content (for simple text messages) */
  content: string
  /** Structured content parts (when files/images are included) */
  parts?: IRContentPart[]
  /** Tool calls made by the assistant */
  toolCalls?: IRToolCall[]
  /** For tool results: the tool call ID this responds to */
  toolCallId?: string
  /** For tool results: the tool name */
  toolName?: string
  /** For tool results: structured JSON result */
  toolResultJson?: unknown
  /** For tool results: whether this is an error result */
  toolResultIsError?: boolean
  /** Whether this is native SDK content that should be passed through as-is */
  isNative?: boolean
  /** Native SDK content to pass through directly to the adapter */
  nativeContent?: unknown
  /** Whether this is a WrapUser component message */
  isWrapUser?: boolean
  /** Tag for wrapping original user content (for WrapUser) */
  wrapUserTag?: string
  /** Mode for positioning new content relative to original (for WrapUser) */
  wrapUserMode?: "prefix" | "suffix"
  /** Conditional render functions for WrapUser that need hasUser context */
  wrapUserConditions?: WrapUserConditionFn[]
}

// JSX namespace for TypeScript
export namespace JSX {
  export interface Element extends PromptElement {}

  export interface ElementChildrenAttribute {
    children: {}
  }

  export interface IntrinsicElements {}
}
