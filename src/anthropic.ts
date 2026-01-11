/**
 * Anthropic SDK prompt adapter (prompt-only, no structured)
 *
 * Use this entry point when you only need the prompt engine
 * and want to avoid importing structured-related dependencies.
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

export * from "./adapters/anthropic"
