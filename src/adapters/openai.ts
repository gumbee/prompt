/**
 * OpenAI SDK adapter
 *
 * @example
 * import { System, User, prompt } from '@gumbee/prompt/openai'
 *
 * const messages = prompt(
 *   <System>You are a helpful assistant.</System>,
 *   <User>Hello!</User>
 * )
 * // => [{ role: 'system', content: '...' }, { role: 'user', content: '...' }]
 */

import { renderToIR } from "../render"
import type { PromptNode, IRContentPart, IRMessage } from "../types"
import { evaluateWrapUserContent, processWrapUsers } from "../utils"
import type {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionAssistantMessageParam,
  ChatCompletionContentPart,
} from "openai/resources/chat/completions"

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
 * OpenAI message type - uses the official SDK types
 */
export type OpenAIMessage = ChatCompletionMessageParam

/**
 * Options for the prompt function
 */
export interface PromptOptions {
  /**
   * Existing messages to reference when using WrapUser.
   * The last user message in this array will be wrapped and combined
   * with WrapUser content.
   */
  messages?: OpenAIMessage[]
}

/**
 * Convert IR file part to OpenAI content part
 */
function toOpenAIContentPart(part: IRContentPart): ChatCompletionContentPart {
  if (part.type === "text") {
    return { type: "text", text: part.text }
  }

  // Image part
  if (part.type === "image") {
    const url = part.isUrl ? part.data : `data:${part.mimeType};base64,${part.data}`

    return {
      type: "image_url",
      image_url: { url },
    }
  }

  // For non-image files, OpenAI doesn't have native support
  // Fall back to describing the file
  return {
    type: "text",
    text: `[File: ${part.filename || "attachment"} (${part.mimeType})]`,
  }
}

/**
 * Extract content as string from OpenAI message
 */
function extractContent(msg: OpenAIMessage): string {
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
 * Convert a single IR message to OpenAI format
 */
function toOpenAIMessage(msg: IRMessage): OpenAIMessage {
  // Handle native content - pass through directly
  if (msg.isNative) {
    return msg.nativeContent as OpenAIMessage
  }

  if (msg.role === "tool") {
    const toolMsg: ChatCompletionToolMessageParam = {
      role: "tool",
      content: msg.content,
      tool_call_id: msg.toolCallId || "",
    }
    return toolMsg
  }

  if (msg.role === "assistant") {
    // Check if this assistant message has tool calls
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      const assistantMsg: ChatCompletionAssistantMessageParam = {
        role: "assistant",
        content: msg.content || null,
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.args),
          },
        })),
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
    return {
      role: "user",
      content: msg.parts.map(toOpenAIContentPart),
    }
  }

  return {
    role: "user",
    content: msg.content,
  }
}

/**
 * Convert JSX to OpenAI SDK message format
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
function buildUserMessage(content: string, parts: IRContentPart[]): OpenAIMessage {
  if (parts.length === 0) {
    return { role: "user", content }
  }

  // Build content array with text first, then file parts
  const contentParts: ChatCompletionContentPart[] = []

  if (content) {
    contentParts.push({ type: "text", text: content })
  }

  for (const part of parts) {
    contentParts.push(toOpenAIContentPart(part))
  }

  return { role: "user", content: contentParts }
}

/**
 * Sort messages to ensure system messages come first
 */
function sortSystemFirst(messages: OpenAIMessage[]): OpenAIMessage[] {
  const systemMessages = messages.filter((m) => m.role === "system")
  const otherMessages = messages.filter((m) => m.role !== "system")
  return [...systemMessages, ...otherMessages]
}

export function prompt(nodes: PromptNode | PromptNode[], options?: PromptOptions): OpenAIMessage[] {
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
      const modifiedMessages: OpenAIMessage[] = [
        ...options.messages.slice(0, lastUserIdx),
        buildUserMessage(processed.content, processed.parts),
        ...options.messages.slice(lastUserIdx + 1),
      ]

      // Append any non-WrapUser messages from JSX
      return sortSystemFirst([...modifiedMessages, ...otherMessages.map(toOpenAIMessage)])
    } else {
      // No existing user message - evaluate conditions with hasUser=false
      const evaluated = wrapUserMessages.map((m) => evaluateWrapUserContent(m, false))
      const combinedContent = evaluated.map((e) => e.content).join("\n\n")
      const combinedParts = evaluated.flatMap((e) => e.parts)

      return sortSystemFirst([...(options.messages ?? []), buildUserMessage(combinedContent, combinedParts), ...otherMessages.map(toOpenAIMessage)])
    }
  }

  // Handle WrapUser without options.messages - render as regular user message (hasUser = false)
  if (wrapUserMessages.length > 0) {
    const evaluated = wrapUserMessages.map((m) => evaluateWrapUserContent(m, false))
    const combinedContent = evaluated.map((e) => e.content).join("\n\n")
    const combinedParts = evaluated.flatMap((e) => e.parts)

    return sortSystemFirst([buildUserMessage(combinedContent, combinedParts), ...otherMessages.map(toOpenAIMessage)])
  }

  // Normal flow: convert IR to native format, ensuring system messages come first
  return sortSystemFirst(ir.map(toOpenAIMessage))
}
