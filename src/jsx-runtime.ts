import { ELEMENT_TYPE, type PromptElement, type PromptNode, type ComponentFunction, type JSX } from "./types"

// Re-export JSX namespace for TypeScript's jsxImportSource
export type { JSX }

/**
 * Fragment component for grouping elements without a wrapper
 */
export const Fragment: unique symbol = Symbol.for("gumbee.llm.fragment")

type JSXProps = Record<string, unknown> & { children?: PromptNode | PromptNode[] }

/**
 * JSX factory function for production builds
 * Called by the JSX transform for elements with a single child
 */
export function jsx(type: string | ComponentFunction | typeof Fragment, props: JSXProps): PromptElement {
  const { children, ...restProps } = props
  const childArray = normalizeChildren(children)

  return {
    $$typeof: ELEMENT_TYPE,
    type: type as string | ComponentFunction,
    props: restProps,
    children: childArray,
  }
}

/**
 * JSX factory function for elements with multiple static children
 */
export function jsxs(type: string | ComponentFunction | typeof Fragment, props: JSXProps): PromptElement {
  return jsx(type, props)
}

/**
 * JSX factory function for development builds (includes source info)
 */
export function jsxDEV(
  type: string | ComponentFunction | typeof Fragment,
  props: JSXProps,
  _key?: string,
  _isStaticChildren?: boolean,
  _source?: { fileName: string; lineNumber: number; columnNumber: number },
  _self?: unknown,
): PromptElement {
  return jsx(type, props)
}

/**
 * Normalizes children into a flat array
 */
function normalizeChildren(children: PromptNode | PromptNode[] | undefined): PromptNode[] {
  if (children === undefined || children === null) {
    return []
  }

  if (Array.isArray(children)) {
    return flattenChildren(children)
  }

  if (typeof children === "boolean") {
    return []
  }

  return [children]
}

/**
 * Flattens nested children arrays
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

// Re-export types for JSX namespace
export type { PromptElement as LLMElement, PromptNode as PromptNode }
