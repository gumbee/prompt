import { ELEMENT_TYPE, type PromptElement, type PromptNode, type ComponentFunction } from "./types"

/**
 * Creates an LLM element
 */
export function createElement(type: string | ComponentFunction, props: Record<string, unknown> | null, ...children: PromptNode[]): PromptElement {
  return {
    $$typeof: ELEMENT_TYPE,
    type,
    props: props ?? {},
    children: flattenChildren(children),
  }
}

/**
 * Flattens nested children arrays and filters out null/undefined/boolean values
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

/**
 * Checks if a value is an LLM element
 */
export function isElement(value: unknown): value is PromptElement {
  return typeof value === "object" && value !== null && "$$typeof" in value && value.$$typeof === ELEMENT_TYPE
}
