import { createElement } from "../element"
import type { PromptElement, PromptNode, MessageProps } from "../types"

/**
 * Internal message component type identifiers
 */
export const MESSAGE_TYPES = {
  SYSTEM: "llm:system",
  USER: "llm:user",
  ASSISTANT: "llm:assistant",
  TOOL_RESULT: "llm:tool-result",
  TOOL_CALL: "llm:tool-call",
} as const

/**
 * System message component
 * Used to set the system prompt / instructions
 */
export function System(props: MessageProps): PromptElement {
  return createElement(MESSAGE_TYPES.SYSTEM, null, props.children)
}

/**
 * User message component
 * Represents user input in the conversation
 */
export function User(props: MessageProps): PromptElement {
  return createElement(MESSAGE_TYPES.USER, null, props.children)
}

/**
 * Assistant message component
 * Represents assistant responses in the conversation
 */
export function Assistant(props: MessageProps): PromptElement {
  return createElement(MESSAGE_TYPES.ASSISTANT, null, props.children)
}

/**
 * Tool result component props
 */
export interface ToolResultProps extends MessageProps {
  /** The tool call ID this result corresponds to */
  id: string
  /** The name of the tool (optional, some SDKs don't require it) */
  name?: string
  /** Structured JSON result (preferred over children for structured data) */
  json?: unknown
  /** Whether this result represents an error */
  isError?: boolean
}

/**
 * Tool result component
 * Represents the result of a tool/function call
 *
 * @example Text result
 * <ToolResult id="call_abc123" name="get_weather">
 *   The weather is sunny and 22°C
 * </ToolResult>
 *
 * @example JSON result (preferred for structured data)
 * <ToolResult id="call_abc123" name="get_weather" json={{ temperature: 22, condition: "sunny" }} />
 *
 * @example Error result
 * <ToolResult id="call_abc123" name="get_weather" isError>
 *   City not found
 * </ToolResult>
 *
 * @example JSON error result
 * <ToolResult id="call_abc123" name="get_weather" json={{ code: 404, message: "City not found" }} isError />
 */
export function ToolResult(props: ToolResultProps): PromptElement {
  const { children, json, isError, ...restProps } = props
  return createElement(MESSAGE_TYPES.TOOL_RESULT, { ...restProps, json, isError }, children)
}

/**
 * Tool call component props
 */
export interface ToolCallProps {
  /** Unique ID for this tool call */
  id: string
  /** Name of the tool being called */
  name: string
  /** Arguments passed to the tool */
  input: Record<string, unknown>
}

/**
 * Tool call component
 * Represents the assistant requesting to use a tool
 * Creates an assistant message with a tool call
 *
 * @example
 * <ToolCall
 *   id="call_abc123"
 *   name="get_weather"
 *   input={{ city: "Tokyo" }}
 * />
 */
export function ToolCall(props: ToolCallProps): PromptElement {
  return createElement(MESSAGE_TYPES.TOOL_CALL, {
    id: props.id,
    name: props.name,
    input: props.input,
  })
}

/**
 * Check if a type string is a message component
 */
export function isMessageType(type: string): type is (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES] {
  return Object.values(MESSAGE_TYPES).includes(type as (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES])
}

/**
 * Get the role from a message type
 */
export function getRoleFromType(type: string): "system" | "user" | "assistant" | "tool" | null {
  switch (type) {
    case MESSAGE_TYPES.SYSTEM:
      return "system"
    case MESSAGE_TYPES.USER:
      return "user"
    case MESSAGE_TYPES.ASSISTANT:
    case MESSAGE_TYPES.TOOL_CALL:
      return "assistant"
    case MESSAGE_TYPES.TOOL_RESULT:
      return "tool"
    default:
      return null
  }
}
