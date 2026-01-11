/**
 * OpenAI SDK prompt adapter (prompt-only, no structured)
 *
 * Use this entry point when you only need the prompt engine
 * and want to avoid importing structured-related dependencies.
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

export * from "./adapters/openai"
