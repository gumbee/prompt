/**
 * Anthropic SDK adapter
 *
 * Anthropic has a different message format where system messages
 * are passed separately from the conversation messages.
 *
 * @example
 * import { System, User, prompt } from '@gumbee/prompt/anthropic'
 *
 * const { system, messages } = prompt(
 *   <System>You are Claude.</System>,
 *   <User>Hello!</User>
 * )
 * // system => 'You are Claude.'
 * // messages => [{ role: 'user', content: '...' }]
 */

import { renderToIR } from "../render"
import type { PromptNode, IRContentPart, IRMessage } from "../types"
import { evaluateWrapUserContent, processWrapUsers } from "../utils"
import type {
  MessageParam,
  ToolResultBlockParam,
  ToolUseBlockParam,
  ContentBlockParam,
  ImageBlockParam,
  TextBlockParam,
  DocumentBlockParam,
} from "@anthropic-ai/sdk/resources/messages"

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
 * Anthropic message type - uses the official SDK types
 */
export type AnthropicMessage = MessageParam

/**
 * Anthropic prompt output
 * System message is separated from conversation messages
 */
export interface AnthropicOutput {
  system: string | undefined
  messages: MessageParam[]
}

/**
 * Options for the prompt function
 */
export interface PromptOptions {
  /**
   * Existing messages to reference when using WrapUser.
   * The last user message in this array will be wrapped and combined
   * with WrapUser content.
   */
  messages?: MessageParam[]
}

/**
 * Anthropic content block type
 */
type AnthropicContentBlock = TextBlockParam | ImageBlockParam | DocumentBlockParam

/**
 * Convert IR file part to Anthropic content block
 */
function toAnthropicContentBlock(part: IRContentPart): AnthropicContentBlock {
  if (part.type === "text") {
    return { type: "text", text: part.text }
  }

  // Image part
  if (part.type === "image") {
    if (part.isUrl) {
      return {
        type: "image",
        source: {
          type: "url",
          url: part.data,
        },
      }
    }
    // Base64 data
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: part.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: part.data,
      },
    }
  }

  // File/document part
  if (part.mimeType === "application/pdf") {
    if (part.isUrl) {
      return {
        type: "document",
        source: {
          type: "url",
          url: part.data,
        },
      }
    }
    return {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: part.data,
      },
    }
  }

  // Fallback for unsupported file types
  return {
    type: "text",
    text: `[File: ${part.filename || "attachment"} (${part.mimeType})]`,
  }
}

/**
 * Extract content as string from Anthropic message
 */
function extractContent(msg: MessageParam): string {
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
 * Convert a single IR message to Anthropic format
 */
function toAnthropicMessage(msg: IRMessage): MessageParam | null {
  // Handle native content - pass through directly
  if (msg.isNative) {
    return msg.nativeContent as MessageParam
  }

  if (msg.role === "system") {
    return null // System messages are handled separately
  }

  if (msg.role === "tool") {
    const toolResult: ToolResultBlockParam = {
      type: "tool_result",
      tool_use_id: msg.toolCallId || "",
      content: msg.content,
    }
    return {
      role: "user",
      content: [toolResult],
    }
  }

  if (msg.role === "assistant") {
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      const content: ContentBlockParam[] = []

      if (msg.content) {
        content.push({ type: "text", text: msg.content })
      }

      for (const tc of msg.toolCalls) {
        const toolUse: ToolUseBlockParam = {
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.input,
        }
        content.push(toolUse)
      }

      return {
        role: "assistant",
        content,
      }
    }

    return {
      role: "assistant",
      content: msg.content,
    }
  }

  // User message
  if (msg.parts && msg.parts.length > 0) {
    return {
      role: "user",
      content: msg.parts.map(toAnthropicContentBlock),
    }
  }

  return {
    role: "user",
    content: msg.content,
  }
}

/**
 * Convert JSX to Anthropic SDK format
 * Accepts multiple elements - no need to wrap in a fragment
 * System messages are extracted and returned separately
 *
 * @param nodes - JSX nodes to convert
 * @param options - Optional configuration including existing messages for WrapUser
 *
 * @example Basic usage
 * const { system, messages } = prompt(
 *   <System>You are Claude.</System>,
 *   <User>Hello!</User>
 * )
 *
 * @example With WrapUser
 * const { system, messages } = prompt(
 *   <WrapUser tag="original" mode="suffix">
 *     Please respond in JSON.
 *   </WrapUser>,
 *   { messages: existingMessages }
 * )
 */
/**
 * Build a user message with optional parts
 */
function buildUserMessage(content: string, parts: IRContentPart[]): MessageParam {
  if (parts.length === 0) {
    return { role: "user", content }
  }

  // Build content array with text first, then file parts
  const contentBlocks: AnthropicContentBlock[] = []

  if (content) {
    contentBlocks.push({ type: "text", text: content })
  }

  for (const part of parts) {
    contentBlocks.push(toAnthropicContentBlock(part))
  }

  return { role: "user", content: contentBlocks }
}

export function prompt(nodes: PromptNode | PromptNode[], options?: PromptOptions): AnthropicOutput {
  const nodeArray = Array.isArray(nodes) ? nodes : [nodes]
  const ir = renderToIR(nodeArray)

  // Extract system messages (Anthropic combines them)
  const systemMessages = ir.filter((msg) => msg.role === "system" && !msg.isNative && !msg.isWrapUser)
  const system = systemMessages.length > 0 ? systemMessages.map((msg) => msg.content).join("\n\n") : undefined

  // Find all WrapUser messages in IR (preserving order)
  const wrapUserMessages = ir.filter((m) => m.isWrapUser)
  // Non-WrapUser, non-system messages to process normally
  const otherMessages = ir.filter((m) => !m.isWrapUser && m.role !== "system")

  // Handle WrapUser components if present
  if (wrapUserMessages.length > 0 && options?.messages) {
    // Find last user message from options.messages
    const lastUserIdx = options.messages.findLastIndex((m) => m.role === "user")

    if (lastUserIdx >= 0) {
      const originalContent = extractContent(options.messages[lastUserIdx]!)

      // Process all WrapUser components sequentially (hasUser = true)
      const processed = processWrapUsers(wrapUserMessages, originalContent, true)

      // Build result: existing messages with last user replaced
      const modifiedMessages: MessageParam[] = [
        ...options.messages.slice(0, lastUserIdx),
        buildUserMessage(processed.content, processed.parts),
        ...options.messages.slice(lastUserIdx + 1),
      ]

      // Append any non-WrapUser messages from JSX
      const additionalMessages = otherMessages.map(toAnthropicMessage).filter((m): m is MessageParam => m !== null)

      return { system, messages: [...modifiedMessages, ...additionalMessages] }
    } else {
      // No existing user message - evaluate conditions with hasUser=false
      const evaluated = wrapUserMessages.map((m) => evaluateWrapUserContent(m, false))
      const combinedContent = evaluated.map((e) => e.content).join("\n\n")
      const combinedParts = evaluated.flatMap((e) => e.parts)
      const additionalMessages = otherMessages.map(toAnthropicMessage).filter((m): m is MessageParam => m !== null)

      return {
        system,
        messages: [...(options.messages ?? []), buildUserMessage(combinedContent, combinedParts), ...additionalMessages],
      }
    }
  }

  // Handle WrapUser without options.messages - render as regular user message (hasUser = false)
  if (wrapUserMessages.length > 0) {
    const evaluated = wrapUserMessages.map((m) => evaluateWrapUserContent(m, false))
    const combinedContent = evaluated.map((e) => e.content).join("\n\n")
    const combinedParts = evaluated.flatMap((e) => e.parts)
    const additionalMessages = otherMessages.map(toAnthropicMessage).filter((m): m is MessageParam => m !== null)

    return { system, messages: [buildUserMessage(combinedContent, combinedParts), ...additionalMessages] }
  }

  // Normal flow: convert IR to native format
  const messages = otherMessages.map(toAnthropicMessage).filter((m): m is MessageParam => m !== null)

  return { system, messages }
}
