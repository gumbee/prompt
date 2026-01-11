/**
 * Shared utilities for processing WrapUser components across adapters
 */

import { wrapXml } from "./components/xml"
import { renderToContent } from "./render"
import type { IRMessage, IRContentPart } from "./types"

/**
 * Result of evaluating WrapUser content
 */
export interface EvaluatedContent {
  content: string
  parts: IRContentPart[]
}

/**
 * Placeholder pattern for deferred WrapUser condition functions.
 * Format: \x00COND_<index>\x00 where index is the function index
 */
const CONDITION_PLACEHOLDER_REGEX = /\x00COND_(\d+)\x00/g

/**
 * Evaluate WrapUser content including any conditional render functions.
 * Replaces placeholder markers with evaluated function results to preserve
 * the original child order from JSX.
 */
export function evaluateWrapUserContent(msg: IRMessage, hasUser: boolean): EvaluatedContent {
  let content = msg.content
  const allParts: IRContentPart[] = []

  if (msg.wrapUserConditions && msg.wrapUserConditions.length > 0) {
    // Build a map of index -> evaluated result
    const evaluatedResults: Map<number, string> = new Map()

    for (let i = 0; i < msg.wrapUserConditions.length; i++) {
      const fn = msg.wrapUserConditions[i]
      const result = fn({ hasUser })

      if (result === null || result === undefined || result === false) {
        evaluatedResults.set(i, "")
      } else if (typeof result === "string") {
        evaluatedResults.set(i, result)
      } else {
        // Render JSX nodes to content and parts
        const rendered = renderToContent(result)
        evaluatedResults.set(i, rendered.content)
        allParts.push(...rendered.parts)
      }
    }

    // Replace placeholders with evaluated results, preserving order
    content = content.replace(CONDITION_PLACEHOLDER_REGEX, (_, indexStr) => {
      const idx = parseInt(indexStr, 10)
      return evaluatedResults.get(idx) ?? ""
    })
  }

  return { content, parts: allParts }
}

/**
 * Result of processing WrapUser messages
 */
export interface ProcessedWrapUser {
  content: string
  parts: IRContentPart[]
}

/**
 * Process multiple WrapUser messages and combine with original content
 */
export function processWrapUsers(wrapUserMessages: IRMessage[], originalContent: string, hasUser: boolean): ProcessedWrapUser {
  const prefixes: string[] = []
  const suffixes: string[] = []
  const allParts: IRContentPart[] = []
  let finalTag = "user"

  for (const msg of wrapUserMessages) {
    const mode = msg.wrapUserMode ?? "suffix"
    const evaluated = evaluateWrapUserContent(msg, hasUser)
    allParts.push(...evaluated.parts)

    if (mode === "prefix") {
      prefixes.push(evaluated.content)
    } else {
      suffixes.push(evaluated.content)
    }

    // Last one wins for tag
    finalTag = msg.wrapUserTag ?? "user"
  }

  // Build final content with wrapped original (indent: 2 matches Group component default)
  const wrappedOriginal = wrapXml(finalTag, originalContent, { indent: 2 })

  const textParts = [...prefixes, wrappedOriginal, ...suffixes]

  return {
    content: textParts.join("\n\n"),
    parts: allParts,
  }
}
