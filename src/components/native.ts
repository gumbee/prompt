/**
 * Native content passthrough component
 *
 * Allows injecting pre-formatted SDK-native content directly into the message stream.
 * This is useful when you need to include content that's already in the target SDK's
 * format (e.g., Anthropic's MessageParam, OpenAI's ChatCompletionMessage).
 */

import { createElement } from "../element"
import type { PromptElement } from "../types"

/**
 * Internal type identifier for native content
 */
export const NATIVE_TYPE = "llm:native" as const

/**
 * Props for the Native component
 */
export interface NativeProps {
  /**
   * Native SDK content to pass through directly to the adapter.
   * The content should match the target SDK's message format.
   *
   * @example Anthropic format
   * <Native content={{ role: "user", content: "Hello" }} />
   *
   * @example OpenAI format
   * <Native content={{ role: "user", content: "Hello" }} />
   */
  content: unknown
}

/**
 * Pass through native SDK content directly to the adapter.
 *
 * This component allows you to inject content that's already in the target
 * SDK's native format. The content will be passed through to the adapter
 * without any transformation.
 *
 * @example
 * import { User, Native, prompt } from '@gumbee/prompt/anthropic'
 *
 * const { messages } = prompt(
 *   <User>Regular JSX message</User>,
 *   <Native content={{
 *     role: "user",
 *     content: [{ type: "text", text: "Native Anthropic message" }]
 *   }} />
 * )
 */
export function Native(props: NativeProps): PromptElement {
  return createElement(NATIVE_TYPE, { content: props.content })
}

/**
 * Check if a type is the native content type
 */
export function isNativeType(type: string): boolean {
  return type === NATIVE_TYPE
}
