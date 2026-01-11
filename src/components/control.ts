import { createElement } from "../element"
import type { PromptElement, PromptNode, IfProps, ShowProps, EachProps } from "../types"

/**
 * Internal control flow component type identifiers
 */
export const CONTROL_TYPES = {
  IF: "llm:if",
  SHOW: "llm:show",
  EACH: "llm:each",
} as const

/**
 * Conditional rendering component
 * Renders children only if condition is true
 *
 * @example
 * <If condition={isVIP}>
 *   You have VIP access!
 * </If>
 */
export function If(props: IfProps): PromptElement | null {
  if (!props.condition) {
    return null as unknown as PromptElement
  }
  return createElement(CONTROL_TYPES.IF, { condition: props.condition }, props.children)
}

/**
 * Conditional rendering with fallback
 * Renders children when condition is true, fallback otherwise
 *
 * @example
 * <Show when={isLoggedIn} fallback={<>Please log in</>}>
 *   Welcome back!
 * </Show>
 */
export function Show(props: ShowProps): PromptElement {
  if (props.when) {
    return createElement(CONTROL_TYPES.SHOW, { when: props.when }, props.children)
  }
  if (props.fallback !== undefined) {
    return createElement(CONTROL_TYPES.SHOW, { when: props.when }, props.fallback)
  }
  return null as unknown as PromptElement
}

/**
 * List iteration component
 * Maps over items and renders children for each
 *
 * @example
 * <Each items={users}>
 *   {(user, index) => `${index + 1}. ${user.name}`}
 * </Each>
 */
export function Each<T>(props: EachProps<T>): PromptElement {
  // Handle JSX children - when passed through JSX runtime, function gets wrapped in an array
  const renderFn = Array.isArray(props.children) ? (props.children[0] as (item: T, index: number) => PromptNode) : props.children
  const renderedItems = props.items.map((item, index) => renderFn(item, index))
  return createElement(CONTROL_TYPES.EACH, { items: props.items }, ...renderedItems)
}

/**
 * Linebreak props
 */
export interface LinebreakProps {
  /** Number of line breaks to insert (default: 1) */
  repeat?: number
}

/**
 * Insert line breaks
 * Cleaner alternative to {'\n'} interpolation
 *
 * @example
 * <Linebreak />        // inserts "\n"
 * <Linebreak repeat={2} />  // inserts "\n\n"
 */
export function Linebreak(props: LinebreakProps): string {
  const count = props.repeat ?? 1
  return "\n".repeat(count)
}
