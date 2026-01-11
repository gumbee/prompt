/**
 * WrapUser component for combining new content with existing user messages
 *
 * This component works with the adapter's prompt() function to intelligently
 * combine new JSX content with existing native messages.
 */

import { createElement } from "../element"
import type { PromptElement, PromptNode } from "../types"

/**
 * Internal type identifier for WrapUser content
 */
export const WRAP_USER_TYPE = "llm:wrap-user" as const

/**
 * Mode for how new content is positioned relative to original
 */
export type WrapUserMode = "prefix" | "suffix"

/**
 * Context object passed to WrapUser conditional functions
 */
export interface WrapUserContext {
  /** Whether there's an existing user message in the conversation */
  hasUser: boolean
}

/**
 * Conditional render function that receives WrapUser context
 * Use this to render content conditionally based on whether there's an existing user message
 */
export type WrapUserCondition = (context: WrapUserContext) => PromptNode

/**
 * Props for the WrapUser component
 */
export interface WrapUserProps {
  /**
   * Tag for the Group that wraps original content.
   * The original user message content will be wrapped in XML-style tags
   * using this value: `<tag>original content</tag>`
   *
   * @default "user"
   */
  tag?: string

  /**
   * Whether new content is prefix or suffix to original.
   * - "suffix": new content comes after wrapped original
   * - "prefix": new content comes before wrapped original
   *
   * @default "suffix"
   */
  mode?: WrapUserMode

  /**
   * The new content to add to the user message.
   * Can include conditional functions that receive context with hasUser status:
   *
   * @example
   * <WrapUser>
   *   Static content {({ hasUser }) => hasUser ? "with user context" : "without user context"}
   *   <MoreContent />
   * </WrapUser>
   */
  children?: PromptNode
}

/**
 * Wraps and combines new content with existing user messages.
 *
 * When used with the adapter's prompt() function with a `messages` option,
 * this component will:
 * 1. Find the last user message from the provided messages
 * 2. Wrap that original content in a Group with the specified tag
 * 3. Combine with the new content based on the mode (prefix/suffix)
 *
 * If no user message exists in the provided messages, a new user message
 * is created with just the new content.
 *
 * @example
 * import { WrapUser, prompt } from '@gumbee/prompt/openai'
 *
 * const existingMessages = [
 *   { role: "user", content: "What's 2+2?" }
 * ]
 *
 * const result = prompt(
 *   <WrapUser tag="original-query" mode="suffix">
 *     Please respond in JSON format.
 *   </WrapUser>,
 *   { messages: existingMessages }
 * )
 *
 * // Result:
 * // <original-query>
 * // What's 2+2?
 * // </original-query>
 * //
 * // Please respond in JSON format.
 */
export function WrapUser(props: WrapUserProps): PromptElement {
  return createElement(
    WRAP_USER_TYPE,
    {
      tag: props.tag ?? "user",
      mode: props.mode ?? "suffix",
    },
    props.children,
  )
}

/**
 * Check if a type is the WrapUser content type
 */
export function isWrapUserType(type: string): boolean {
  return type === WRAP_USER_TYPE
}
