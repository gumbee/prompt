/**
 * Tests for the WrapUser component
 *
 * WrapUser combines new JSX content with existing user messages from
 * a conversation history. It's used with the adapter's prompt() function.
 */
import { describe, it, expect } from "vitest"
import { renderToIR } from "../render"
import { WrapUser, isWrapUserType, WRAP_USER_TYPE } from "./wrap-user"
import { User, System, Assistant } from "./message"
import { prompt as aiSdkPrompt } from "../adapters/ai-sdk"
import { prompt as openaiPrompt } from "../adapters/openai"
import { prompt as anthropicPrompt } from "../adapters/anthropic"
import type { ModelMessage } from "ai"
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages"
import { Group } from "./xml"
import { Bold, Heading, List, Item } from "./markdown"

describe("WrapUser", () => {
  describe("IR rendering", () => {
    it("should create a message with isWrapUser flag", () => {
      const ir = renderToIR(<WrapUser>New content</WrapUser>)

      expect(ir).toHaveLength(1)
      expect(ir[0].isWrapUser).toBe(true)
      expect(ir[0].role).toBe("user")
    })

    it("should use default tag 'user' when not specified", () => {
      const ir = renderToIR(<WrapUser>Content</WrapUser>)

      expect(ir[0].wrapUserTag).toBe("user")
    })

    it("should use custom tag when specified", () => {
      const ir = renderToIR(<WrapUser tag="original-query">Content</WrapUser>)

      expect(ir[0].wrapUserTag).toBe("original-query")
    })

    it("should use default mode 'suffix' when not specified", () => {
      const ir = renderToIR(<WrapUser>Content</WrapUser>)

      expect(ir[0].wrapUserMode).toBe("suffix")
    })

    it("should use custom mode when specified", () => {
      const ir = renderToIR(<WrapUser mode="prefix">Content</WrapUser>)

      expect(ir[0].wrapUserMode).toBe("prefix")
    })

    it("should render children content", () => {
      const ir = renderToIR(<WrapUser>Please respond in JSON format.</WrapUser>)

      expect(ir[0].content).toBe("Please respond in JSON format.")
    })

    it("should handle complex children", () => {
      const ir = renderToIR(
        <WrapUser tag="context">
          <Group tag="instructions">
            <Bold>Important:</Bold> Follow these rules.
          </Group>
        </WrapUser>,
      )

      expect(ir[0].isWrapUser).toBe(true)
      expect(ir[0].content).toContain("<instructions>")
      expect(ir[0].content).toContain("**Important:**")
    })

    it("should handle multiple WrapUser components", () => {
      const ir = renderToIR([
        <WrapUser mode="prefix" tag="context">
          Context first
        </WrapUser>,
        <WrapUser mode="suffix" tag="user">
          Instructions after
        </WrapUser>,
      ])

      expect(ir).toHaveLength(2)
      expect(ir[0].isWrapUser).toBe(true)
      expect(ir[0].wrapUserMode).toBe("prefix")
      expect(ir[1].isWrapUser).toBe(true)
      expect(ir[1].wrapUserMode).toBe("suffix")
    })

    it("should work alongside regular messages", () => {
      const ir = renderToIR([<System>You are helpful.</System>, <WrapUser>Additional instructions</WrapUser>])

      expect(ir).toHaveLength(2)
      expect(ir[0].role).toBe("system")
      expect(ir[0].isWrapUser).toBeUndefined()
      expect(ir[1].isWrapUser).toBe(true)
    })
  })

  describe("isWrapUserType helper", () => {
    it("should return true for WrapUser type", () => {
      expect(isWrapUserType(WRAP_USER_TYPE)).toBe(true)
    })

    it("should return false for other types", () => {
      expect(isWrapUserType("llm:user")).toBe(false)
      expect(isWrapUserType("llm:system")).toBe(false)
      expect(isWrapUserType("random")).toBe(false)
    })
  })

  describe("AI SDK adapter integration", () => {
    it("should combine WrapUser content with existing user message (suffix mode)", () => {
      const existingMessages: ModelMessage[] = [{ role: "user", content: "What's 2+2?" }]

      const messages = aiSdkPrompt(<WrapUser>Please respond in JSON.</WrapUser>, {
        messages: existingMessages,
      })

      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe("user")
      expect((messages[0] as any).content).toContain("<user>")
      expect((messages[0] as any).content).toContain("What's 2+2?")
      expect((messages[0] as any).content).toContain("</user>")
      expect((messages[0] as any).content).toContain("Please respond in JSON.")
    })

    it("should combine WrapUser content with existing user message (prefix mode)", () => {
      const existingMessages: ModelMessage[] = [{ role: "user", content: "Original question" }]

      const messages = aiSdkPrompt(<WrapUser mode="prefix">Context before</WrapUser>, { messages: existingMessages })

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      // Prefix should come before the wrapped original
      expect(content.indexOf("Context before")).toBeLessThan(content.indexOf("<user>"))
    })

    it("should use custom tag for wrapping original content", () => {
      const existingMessages: ModelMessage[] = [{ role: "user", content: "My query" }]

      const messages = aiSdkPrompt(<WrapUser tag="original-query">New instructions</WrapUser>, { messages: existingMessages })

      expect((messages[0] as any).content).toContain("<original-query>")
      expect((messages[0] as any).content).toContain("</original-query>")
    })

    it("should find and replace the last user message", () => {
      const existingMessages: ModelMessage[] = [
        { role: "user", content: "First question" },
        { role: "assistant", content: "First answer" },
        { role: "user", content: "Second question" },
      ]

      const messages = aiSdkPrompt(<WrapUser>Extra info</WrapUser>, {
        messages: existingMessages,
      })

      expect(messages).toHaveLength(3)
      // First two messages unchanged
      expect((messages[0] as any).content).toBe("First question")
      expect((messages[1] as any).content).toBe("First answer")
      // Last user message is modified
      expect((messages[2] as any).content).toContain("Second question")
      expect((messages[2] as any).content).toContain("Extra info")
    })

    it("should create new user message when no existing user message", () => {
      const existingMessages: ModelMessage[] = [{ role: "system", content: "System prompt" }]

      const messages = aiSdkPrompt(<WrapUser>User content</WrapUser>, {
        messages: existingMessages,
      })

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe("system")
      expect(messages[1].role).toBe("user")
      expect((messages[1] as any).content).toBe("User content")
    })

    it("should render as regular user message without messages option", () => {
      const messages = aiSdkPrompt(<WrapUser>Just content</WrapUser>)

      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe("user")
      expect((messages[0] as any).content).toBe("Just content")
    })

    it("should handle multiple WrapUser components", () => {
      const existingMessages: ModelMessage[] = [{ role: "user", content: "Original" }]

      const messages = aiSdkPrompt(
        [
          <WrapUser mode="prefix" tag="context">
            Before
          </WrapUser>,
          <WrapUser mode="suffix" tag="user">
            After
          </WrapUser>,
        ],
        { messages: existingMessages },
      )

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(content).toContain("Before")
      expect(content).toContain("Original")
      expect(content).toContain("After")
    })

    it("should preserve non-WrapUser messages from JSX", () => {
      const existingMessages: ModelMessage[] = [{ role: "user", content: "Original" }]

      const messages = aiSdkPrompt([<WrapUser>Extra</WrapUser>, <Assistant>I understand</Assistant>], { messages: existingMessages })

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe("user")
      expect(messages[1].role).toBe("assistant")
    })
  })

  describe("OpenAI adapter integration", () => {
    it("should combine WrapUser content with existing user message", () => {
      const existingMessages: ChatCompletionMessageParam[] = [{ role: "user", content: "What's 2+2?" }]

      const messages = openaiPrompt(<WrapUser>Please respond in JSON.</WrapUser>, {
        messages: existingMessages,
      })

      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe("user")
      expect((messages[0] as any).content).toContain("<user>")
      expect((messages[0] as any).content).toContain("What's 2+2?")
      expect((messages[0] as any).content).toContain("Please respond in JSON.")
    })

    it("should use prefix mode correctly", () => {
      const existingMessages: ChatCompletionMessageParam[] = [{ role: "user", content: "Original query" }]

      const messages = openaiPrompt(<WrapUser mode="prefix">Prefix content</WrapUser>, { messages: existingMessages })

      const content = (messages[0] as any).content
      expect(content.indexOf("Prefix content")).toBeLessThan(content.indexOf("<user>"))
    })

    it("should create new user message without messages option", () => {
      const messages = openaiPrompt(<WrapUser>Content only</WrapUser>)

      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe("user")
      expect((messages[0] as any).content).toBe("Content only")
    })
  })

  describe("Anthropic adapter integration", () => {
    it("should combine WrapUser content with existing user message", () => {
      const existingMessages: MessageParam[] = [{ role: "user", content: "What's 2+2?" }]

      const { messages } = anthropicPrompt(<WrapUser>Please respond in JSON.</WrapUser>, {
        messages: existingMessages,
      })

      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe("user")
      expect((messages[0] as any).content).toContain("<user>")
      expect((messages[0] as any).content).toContain("What's 2+2?")
      expect((messages[0] as any).content).toContain("Please respond in JSON.")
    })

    it("should handle system messages separately", () => {
      const existingMessages: MessageParam[] = [{ role: "user", content: "Question" }]

      const { messages, system } = anthropicPrompt([<System>System prompt</System>, <WrapUser>Extra</WrapUser>], { messages: existingMessages })

      expect(system).toBe("System prompt")
      expect(messages).toHaveLength(1)
      expect((messages[0] as any).content).toContain("Question")
      expect((messages[0] as any).content).toContain("Extra")
    })

    it("should use prefix mode correctly", () => {
      const existingMessages: MessageParam[] = [{ role: "user", content: "Original" }]

      const { messages } = anthropicPrompt(<WrapUser mode="prefix">Prefix here</WrapUser>, { messages: existingMessages })

      const content = (messages[0] as any).content
      expect(content.indexOf("Prefix here")).toBeLessThan(content.indexOf("<user>"))
    })
  })

  describe("child ordering across adapters", () => {
    it("should preserve child order with conditional function in AI SDK", () => {
      const existingMessages: ModelMessage[] = [{ role: "user", content: "user prompt" }]

      const messages = aiSdkPrompt(
        <WrapUser>
          Respond with JSON.
          {({ hasUser }) => hasUser && " Reply to the user."}
          <Group tag="guidelines">Instructions here</Group>
        </WrapUser>,
        { messages: existingMessages },
      )

      const content = (messages[0] as any).content
      // The conditional result should appear BEFORE the Group, preserving JSX child order
      const replyIndex = content.indexOf("Reply to the user.")
      const guidelinesIndex = content.indexOf("<guidelines>")
      expect(replyIndex).toBeLessThan(guidelinesIndex)
      expect(content).toContain("Respond with JSON. Reply to the user.")
    })

    it("should preserve child order with conditional function in OpenAI", () => {
      const existingMessages: ChatCompletionMessageParam[] = [{ role: "user", content: "user prompt" }]

      const messages = openaiPrompt(
        <WrapUser>
          Respond with JSON.
          {({ hasUser }) => hasUser && " Reply to the user."}
          <Group tag="guidelines">Instructions here</Group>
        </WrapUser>,
        { messages: existingMessages },
      )

      const content = (messages[0] as any).content
      const replyIndex = content.indexOf("Reply to the user.")
      const guidelinesIndex = content.indexOf("<guidelines>")
      expect(replyIndex).toBeLessThan(guidelinesIndex)
    })

    it("should preserve child order with conditional function in Anthropic", () => {
      const existingMessages: MessageParam[] = [{ role: "user", content: "user prompt" }]

      const { messages } = anthropicPrompt(
        <WrapUser>
          Respond with JSON.
          {({ hasUser }) => hasUser && " Reply to the user."}
          <Group tag="guidelines">Instructions here</Group>
        </WrapUser>,
        { messages: existingMessages },
      )

      const content = (messages[0] as any).content
      const replyIndex = content.indexOf("Reply to the user.")
      const guidelinesIndex = content.indexOf("<guidelines>")
      expect(replyIndex).toBeLessThan(guidelinesIndex)
    })

    it("should inline conditional result when placed directly after text", () => {
      const existingMessages: ModelMessage[] = [{ role: "user", content: "test" }]

      const messages = aiSdkPrompt(
        <WrapUser>
          {"Content"}
          {({ hasUser }) => hasUser && " inline text"}
        </WrapUser>,
        { messages: existingMessages },
      )

      const content = (messages[0] as any).content
      // Inline placement should work without extra newlines
      expect(content).toContain("Content inline text")
    })

    it("should handle multiple conditional functions in order", () => {
      const existingMessages: ModelMessage[] = [{ role: "user", content: "test" }]

      const messages = aiSdkPrompt(
        <WrapUser>
          Start.
          {({ hasUser }) => hasUser && " First condition."}
          Middle text.
          {({ hasUser }) => hasUser && " Second condition."}
          End.
        </WrapUser>,
        { messages: existingMessages },
      )

      const content = (messages[0] as any).content
      const startIdx = content.indexOf("Start.")
      const firstIdx = content.indexOf("First condition.")
      const middleIdx = content.indexOf("Middle text.")
      const secondIdx = content.indexOf("Second condition.")
      const endIdx = content.indexOf("End.")

      expect(startIdx).toBeLessThan(firstIdx)
      expect(firstIdx).toBeLessThan(middleIdx)
      expect(middleIdx).toBeLessThan(secondIdx)
      expect(secondIdx).toBeLessThan(endIdx)
    })

    it("should omit conditional content when condition is false", () => {
      const existingMessages: ModelMessage[] = [{ role: "user", content: "test" }]

      const messages = aiSdkPrompt(
        <WrapUser>
          Before.
          {({ hasUser }) => !hasUser && "Should not appear."}
          After.
        </WrapUser>,
        { messages: existingMessages },
      )

      const content = (messages[0] as any).content
      expect(content).not.toContain("Should not appear.")
      expect(content).toContain("Before.")
      expect(content).toContain("After.")
    })
  })

  describe("edge cases", () => {
    it("should handle empty children", () => {
      const ir = renderToIR(<WrapUser>{undefined}</WrapUser>)

      expect(ir[0].isWrapUser).toBe(true)
      expect(ir[0].content).toBe("")
    })

    it("should handle whitespace trimming", () => {
      const ir = renderToIR(<WrapUser> Spaced content </WrapUser>)

      expect(ir[0].content).toBe("Spaced content")
    })

    it("should handle existing messages with array content", () => {
      const existingMessages: ModelMessage[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "First part" },
            { type: "text", text: " Second part" },
          ],
        },
      ]

      const messages = aiSdkPrompt(<WrapUser>Added content</WrapUser>, {
        messages: existingMessages,
      })

      // Should extract and combine text content
      expect((messages[0] as any).content).toContain("First part")
      expect((messages[0] as any).content).toContain("Added content")
    })

    it("should handle empty existing messages array", () => {
      const messages = aiSdkPrompt(<WrapUser>Content</WrapUser>, {
        messages: [],
      })

      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe("user")
      expect((messages[0] as any).content).toBe("Content")
    })
  })
})
