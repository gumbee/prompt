/**
 * Adapter exports
 * Each adapter should be imported directly from its entry point:
 *
 * import { render } from '@gumbee/prompt/openai'
 * import { render } from '@gumbee/prompt/ai-sdk'
 * import { render } from '@gumbee/prompt/anthropic'
 */

export type { OpenAIMessage } from "./openai"
export type { AISDKMessage } from "./ai-sdk"
export type { AnthropicMessage, AnthropicOutput } from "./anthropic"
