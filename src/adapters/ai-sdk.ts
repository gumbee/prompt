/**
 * Vercel AI SDK adapter
 *
 * @example
 * import { System, User, prompt } from '@gumbee/prompt/ai-sdk'
 *
 * const messages = prompt(
 *   <System>You are a helpful assistant.</System>,
 *   <User>Hello!</User>
 * )
 * // => [{ role: 'system', content: '...' }, { role: 'user', content: '...' }]
 */

import { renderToIR } from "../render"
import type { PromptNode, IRContentPart, IRMessage } from "../types"
import type { ModelMessage, ToolModelMessage, AssistantModelMessage, UserModelMessage, ImagePart, FilePart, TextPart } from "ai"
import { evaluateWrapUserContent, processWrapUsers } from "../utils"

// Re-export all components for convenience
export { System, User, Assistant, ToolResult, ToolCall } from "../components/message"
export type { ToolResultProps, ToolCallProps } from "../components/message"
export { If, Show, Each, Linebreak } from "../components/control"
export { List, Item, Heading, Code, Bold, Italic, Strike, Quote, Hr } from "../components/markdown"
export { Json, File } from "../components/data"
export type { JsonProps, FileProps } from "../components/data"
export { Group } from "../components/xml"
export type { GroupProps } from "../components/xml"
export { Native } from "../components/native"
export type { NativeProps } from "../components/native"
export { WrapUser } from "../components/wrap-user"
export type { WrapUserProps, WrapUserMode, WrapUserCondition, WrapUserContext } from "../components/wrap-user"
export { Fragment } from "../jsx-runtime"

/**
 * AI SDK message type - uses the official SDK types
 */
export type AISDKMessage = ModelMessage

/**
 * Options for the prompt function
 */
export interface PromptOptions {
  /**
   * Existing messages to reference when using WrapUser.
   * The last user message in this array will be wrapped and combined
   * with WrapUser content.
   */
  messages?: ModelMessage[]
}

/**
 * AI SDK content part types
 */
type AISDKContentPart = TextPart | ImagePart | FilePart

/**
 * Convert IR file part to AI SDK content part
 */
function toAISDKContentPart(part: IRContentPart): AISDKContentPart {
  if (part.type === "text") {
    return { type: "text", text: part.text }
  }

  // Image part
  if (part.type === "image") {
    if (part.isUrl) {
      return {
        type: "image",
        image: new URL(part.data),
      }
    }
    // Base64 data
    return {
      type: "image",
      image: part.data,
      mediaType: part.mimeType as ImagePart["mediaType"],
    }
  }

  // File part
  if (part.isUrl) {
    return {
      type: "file",
      data: new URL(part.data),
      mediaType: part.mimeType,
    }
  }

  return {
    type: "file",
    data: part.data,
    mediaType: part.mimeType,
  }
}

/**
 * Extract content as string from AI SDK message
 */
function extractContent(msg: ModelMessage): string {
  if (msg.role !== "user" && msg.role !== "system" && msg.role !== "assistant") {
    return ""
  }

  const content = msg.content
  if (typeof content === "string") {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part.type === "text") {
          return part.text
        }
        return ""
      })
      .join("")
  }

  return ""
}

/**
 * Tool result output type matching AI SDK's LanguageModelV2ToolResultOutput
 */
type ToolResultOutput =
  | { type: "text"; value: string }
  | { type: "json"; value: unknown }
  | { type: "error-text"; value: string }
  | { type: "error-json"; value: unknown }

/**
 * Convert tool result to the appropriate output type based on props.
 */
function toToolResultOutput(msg: IRMessage): ToolResultOutput {
  const isError = msg.toolResultIsError ?? false

  // If json prop is provided, use it directly
  if (msg.toolResultJson !== undefined) {
    return isError ? { type: "error-json", value: msg.toolResultJson } : { type: "json", value: msg.toolResultJson }
  }

  // Otherwise use text content
  return isError ? { type: "error-text", value: msg.content } : { type: "text", value: msg.content }
}

/**
 * Convert a single IR message to AI SDK format
 */
function toAISDKMessage(msg: IRMessage): ModelMessage {
  // Handle native content - pass through directly
  if (msg.isNative) {
    return msg.nativeContent as ModelMessage
  }

  if (msg.role === "tool") {
    const toolMessage: ToolModelMessage = {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: msg.toolCallId || "",
          toolName: msg.toolName || "",
          output: toToolResultOutput(msg),
        },
      ],
    }
    return toolMessage
  }

  if (msg.role === "assistant") {
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      const assistantMsg: AssistantModelMessage = {
        role: "assistant",
        content: [
          ...(msg.content ? [{ type: "text" as const, text: msg.content }] : []),
          ...msg.toolCalls.map((tc) => ({
            type: "tool-call" as const,
            toolCallId: tc.id,
            toolName: tc.name,
            args: tc.args,
          })),
        ],
      }
      return assistantMsg
    }

    return {
      role: "assistant",
      content: msg.content,
    }
  }

  if (msg.role === "system") {
    return {
      role: "system",
      content: msg.content,
    }
  }

  // User message - handle file parts
  if (msg.parts && msg.parts.length > 0) {
    const userMsg: UserModelMessage = {
      role: "user",
      content: msg.parts.map(toAISDKContentPart),
    }
    return userMsg
  }

  return {
    role: "user",
    content: msg.content,
  }
}

/**
 * Convert JSX to Vercel AI SDK message format
 * Accepts multiple elements - no need to wrap in a fragment
 *
 * @param nodes - JSX nodes to convert
 * @param options - Optional configuration including existing messages for WrapUser
 *
 * @example Basic usage
 * const messages = prompt(
 *   <System>You are helpful</System>,
 *   <User>Hello!</User>
 * )
 *
 * @example With WrapUser
 * const messages = prompt(
 *   <WrapUser tag="original" mode="suffix">
 *     Please respond in JSON.
 *   </WrapUser>,
 *   { messages: existingMessages }
 * )
 */
/**
 * Build a user message with optional parts
 */
function buildUserMessage(content: string, parts: IRContentPart[]): ModelMessage {
  if (parts.length === 0) {
    return { role: "user", content }
  }

  // Build content array with text first, then file parts
  const contentParts: (TextPart | ImagePart | FilePart)[] = []

  if (content) {
    contentParts.push({ type: "text", text: content })
  }

  for (const part of parts) {
    contentParts.push(toAISDKContentPart(part))
  }

  return { role: "user", content: contentParts }
}

/**
 * Sort messages to ensure system messages come first
 */
function sortSystemFirst(messages: ModelMessage[]): ModelMessage[] {
  const systemMessages = messages.filter((m) => m.role === "system")
  const otherMessages = messages.filter((m) => m.role !== "system")
  return [...systemMessages, ...otherMessages]
}

export function prompt(nodes: PromptNode | PromptNode[], options?: PromptOptions): ModelMessage[] {
  const nodeArray = Array.isArray(nodes) ? nodes : [nodes]
  const ir = renderToIR(nodeArray)

  // Find all WrapUser messages in IR (preserving order)
  const wrapUserMessages = ir.filter((m) => m.isWrapUser)
  // Non-WrapUser messages to process normally
  const otherMessages = ir.filter((m) => !m.isWrapUser)

  // Handle WrapUser components if present
  if (wrapUserMessages.length > 0 && options?.messages) {
    // Find last user message from options.messages
    const lastUserIdx = options.messages.findLastIndex((m) => m.role === "user")

    if (lastUserIdx >= 0) {
      const originalContent = extractContent(options.messages[lastUserIdx]!)

      // Process all WrapUser components sequentially (hasUser = true)
      const processed = processWrapUsers(wrapUserMessages, originalContent, true)

      // Build result: existing messages with last user replaced
      const modifiedMessages: ModelMessage[] = [
        ...options.messages.slice(0, lastUserIdx),
        buildUserMessage(processed.content, processed.parts),
        ...options.messages.slice(lastUserIdx + 1),
      ]

      // Append any non-WrapUser messages from JSX
      return sortSystemFirst([...modifiedMessages, ...otherMessages.map(toAISDKMessage)])
    } else {
      // No existing user message - evaluate conditions with hasUser=false
      const evaluated = wrapUserMessages.map((m) => evaluateWrapUserContent(m, false))
      const combinedContent = evaluated.map((e) => e.content).join("\n\n")
      const combinedParts = evaluated.flatMap((e) => e.parts)

      return sortSystemFirst([...(options.messages ?? []), buildUserMessage(combinedContent, combinedParts), ...otherMessages.map(toAISDKMessage)])
    }
  }

  // Handle WrapUser without options.messages - render as regular user message (hasUser = false)
  if (wrapUserMessages.length > 0) {
    const evaluated = wrapUserMessages.map((m) => evaluateWrapUserContent(m, false))
    const combinedContent = evaluated.map((e) => e.content).join("\n\n")
    const combinedParts = evaluated.flatMap((e) => e.parts)

    return sortSystemFirst([buildUserMessage(combinedContent, combinedParts), ...otherMessages.map(toAISDKMessage)])
  }

  // Normal flow: convert IR to native format, ensuring system messages come first
  return sortSystemFirst(ir.map(toAISDKMessage))
}

// Formatting constants for debug output
const DOUBLE_LINE = "═".repeat(64)
const SINGLE_LINE = "─".repeat(64)

/**
 * Format a role header with appropriate borders
 */
function formatRoleHeader(role: string, isFirst: boolean): string {
  const roleName = role.toUpperCase()
  const line = isFirst ? DOUBLE_LINE : SINGLE_LINE
  return `${isFirst ? "" : "\n"}${line}\n${roleName}\n${line}\n`
}

/**
 * Format content part for debug output
 */
function formatContentPart(part: unknown): string {
  if (typeof part === "string") return part

  if (typeof part === "object" && part !== null) {
    const p = part as Record<string, unknown>
    if (p.type === "text" && typeof p.text === "string") {
      return p.text
    }
    if (p.type === "image") {
      const url = p.image instanceof URL ? p.image.href : "[base64 image]"
      return `<Image url="${url}" />`
    }
    if (p.type === "file") {
      const url = p.data instanceof URL ? p.data.href : "[base64 file]"
      return `<File url="${url}" mimeType="${p.mimeType}" />`
    }
    if (p.type === "tool-call") {
      const argsStr = JSON.stringify(p.args, null, 2)
      return `[Tool Call: ${p.toolName} (id: ${p.toolCallId})]\n${argsStr}`
    }
    if (p.type === "tool-result") {
      return `[Tool Result for: ${p.toolCallId}]\n${typeof p.result === "string" ? p.result : JSON.stringify(p.result, null, 2)}`
    }
  }

  return ""
}

/**
 * Format a single ModelMessage for debug output
 */
function formatModelMessage(msg: ModelMessage, isFirst: boolean): string {
  const parts: string[] = []

  parts.push(formatRoleHeader(msg.role, isFirst))

  const content = msg.content
  if (typeof content === "string") {
    parts.push(content)
  } else if (Array.isArray(content)) {
    const formatted = content.map(formatContentPart).filter(Boolean).join("\n\n")
    parts.push(formatted)
  }

  return parts.join("")
}

/**
 * Convert an array of ModelMessage to a human-readable debug string.
 *
 * Useful for logging and debugging LLM conversations.
 *
 * @param messages - Array of ModelMessage from the AI SDK
 * @returns Formatted debug string with clear visual separation between messages
 *
 * @example
 * const messages = prompt(
 *   <System>You are helpful</System>,
 *   <User>Hello!</User>
 * )
 * console.log(messagesToString(messages))
 * // ════════════════════════════════════════════════════════════════
 * // SYSTEM
 * // ════════════════════════════════════════════════════════════════
 * // You are helpful
 * //
 * // ────────────────────────────────────────────────────────────────
 * // USER
 * // ────────────────────────────────────────────────────────────────
 * // Hello!
 */
export function messagesToString(messages: ModelMessage[]): string {
  if (messages.length === 0) {
    return `${SINGLE_LINE}\n[Empty prompt]\n${SINGLE_LINE}`
  }

  const formatted = messages.map((msg, index) => formatModelMessage(msg, index === 0))
  return formatted.join("") + "\n"
}
