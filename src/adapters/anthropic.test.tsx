/**
 * Tests for the Anthropic adapter
 * Ensures the adapter correctly produces Anthropic SDK compatible message formats
 *
 * Key differences from OpenAI:
 * - System messages are returned separately from the messages array
 * - Tool results are sent as user messages with tool_result content blocks
 * - Tool calls are tool_use content blocks
 * - Image format uses source.type: "url" or "base64"
 */
import { describe, it, expect } from "vitest"
import { prompt, System, User, Assistant, ToolResult, ToolCall, File, Json, If, Each, WrapUser, Group } from "./anthropic"
import type { AnthropicOutput } from "./anthropic"
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages"

describe("Anthropic Adapter", () => {
  describe("unique Anthropic structure", () => {
    it("should return AnthropicOutput with separate system and messages", () => {
      const result = prompt([<System>You are Claude.</System>, <User>Hello!</User>])

      expect(result).toHaveProperty("system")
      expect(result).toHaveProperty("messages")
      expect(typeof result.system).toBe("string")
      expect(Array.isArray(result.messages)).toBe(true)
    })

    it("should extract system message to separate field", () => {
      const result = prompt([<System>You are a helpful AI assistant.</System>, <User>Hi there!</User>])

      expect(result.system).toBe("You are a helpful AI assistant.")
      // System should NOT be in messages array
      expect(result.messages.every((m) => m.role !== "system")).toBe(true)
    })

    it("should combine multiple system messages", () => {
      const result = prompt([<System>First system instruction.</System>, <System>Second system instruction.</System>, <User>Hello!</User>])

      expect(result.system).toBe("First system instruction.\n\nSecond system instruction.")
    })

    it("should return undefined system when no system messages", () => {
      const result = prompt(<User>Hello!</User>)

      expect(result.system).toBeUndefined()
    })
  })

  describe("basic message structure", () => {
    it("should create user message with correct structure", () => {
      const { messages } = prompt(<User>User message content</User>)

      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual({
        role: "user",
        content: "User message content",
      })
    })

    it("should create assistant message with correct structure", () => {
      const { messages } = prompt(<Assistant>Assistant response</Assistant>)

      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual({
        role: "assistant",
        content: "Assistant response",
      })
    })
  })

  describe("multi-turn conversations", () => {
    it("should handle a complete conversation flow", () => {
      const { system, messages } = prompt([
        <System>You are Claude.</System>,
        <User>What is 2+2?</User>,
        <Assistant>The answer is 4.</Assistant>,
        <User>Thanks!</User>,
      ])

      expect(system).toBe("You are Claude.")
      expect(messages).toHaveLength(3) // Excludes system
      expect(messages[0].role).toBe("user")
      expect(messages[1].role).toBe("assistant")
      expect(messages[2].role).toBe("user")
    })

    it("should preserve message order", () => {
      const { messages } = prompt([<User>First</User>, <Assistant>Second</Assistant>, <User>Third</User>])

      expect(
        messages.map((m) => {
          return typeof m.content === "string" ? m.content : ""
        }),
      ).toEqual(["First", "Second", "Third"])
    })
  })

  describe("tool calls (tool_use)", () => {
    it("should create assistant message with tool_use content blocks", () => {
      const { messages } = prompt(<ToolCall id="toolu_123" name="get_weather" args={{ city: "Tokyo" }} />)

      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe("assistant")
      expect(Array.isArray(messages[0].content)).toBe(true)
    })

    it("should format tool_use blocks correctly for Anthropic", () => {
      const { messages } = prompt(<ToolCall id="toolu_abc" name="search" args={{ query: "weather" }} />)

      const content = messages[0].content as any[]
      expect(content[0]).toEqual({
        type: "tool_use",
        id: "toolu_abc",
        name: "search",
        input: { query: "weather" },
      })
    })

    it("should handle multiple tool calls", () => {
      const { messages } = prompt([<ToolCall id="toolu_1" name="tool_a" args={{ x: 1 }} />, <ToolCall id="toolu_2" name="tool_b" args={{ y: 2 }} />])

      // Anthropic combines into single assistant message
      expect(messages).toHaveLength(1)
      const content = messages[0].content as any[]
      expect(content).toHaveLength(2)
      expect(content[0].id).toBe("toolu_1")
      expect(content[1].id).toBe("toolu_2")
    })

    it("should include text content before tool_use blocks", () => {
      const { messages } = prompt([<Assistant>Let me check that.</Assistant>, <ToolCall id="toolu_1" name="lookup" args={{}} />])

      expect(messages).toHaveLength(1)
      const content = messages[0].content as any[]
      expect(content[0]).toEqual({ type: "text", text: "Let me check that." })
      expect(content[1].type).toBe("tool_use")
    })

    it("should use input field for args (not arguments like OpenAI)", () => {
      const { messages } = prompt(<ToolCall id="toolu_1" name="test" args={{ foo: "bar" }} />)

      const content = messages[0].content as any[]
      expect(content[0].input).toEqual({ foo: "bar" })
      expect(content[0].arguments).toBeUndefined()
    })
  })

  describe("tool results (tool_result as user message)", () => {
    it("should wrap tool results in user message with tool_result blocks", () => {
      const { messages } = prompt(<ToolResult id="toolu_123">{'{"result": "sunny"}'}</ToolResult>)

      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe("user") // Anthropic uses user role for tool results
      expect(Array.isArray(messages[0].content)).toBe(true)
    })

    it("should format tool_result blocks correctly", () => {
      const { messages } = prompt(<ToolResult id="toolu_abc">result data</ToolResult>)

      const content = messages[0].content as any[]
      expect(content[0]).toEqual({
        type: "tool_result",
        tool_use_id: "toolu_abc",
        content: "result data",
      })
    })

    it("should handle tool result in full conversation context", () => {
      const { messages } = prompt([
        <User>What is the weather?</User>,
        <ToolCall id="toolu_1" name="get_weather" args={{ city: "Tokyo" }} />,
        <ToolResult id="toolu_1">{'{"temp": 22}'}</ToolResult>,
        <Assistant>It is 22 degrees.</Assistant>,
      ])

      expect(messages).toHaveLength(4)
      expect(messages[0].role).toBe("user")
      expect(messages[1].role).toBe("assistant") // tool call
      expect(messages[2].role).toBe("user") // tool result (user role in Anthropic)
      expect(messages[3].role).toBe("assistant")
    })

    it("should handle multiple tool results as separate user messages", () => {
      const { messages } = prompt([<ToolResult id="toolu_1">result_a</ToolResult>, <ToolResult id="toolu_2">result_b</ToolResult>])

      // Each tool result is a separate user message in Anthropic
      expect(messages).toHaveLength(2)
      expect(messages.every((m) => m.role === "user")).toBe(true)
    })
  })

  describe("multimodal content (images)", () => {
    it("should format image with URL source type", () => {
      const { messages } = prompt(
        <User>
          <File url="https://example.com/image.png" />
        </User>,
      )

      const content = messages[0].content as any[]
      expect(content[0]).toEqual({
        type: "image",
        source: {
          type: "url",
          url: "https://example.com/image.png",
        },
      })
    })

    it("should format base64 image with base64 source type", () => {
      const { messages } = prompt(
        <User>
          <File base64="abc123data" mimeType="image/jpeg" />
        </User>,
      )

      const content = messages[0].content as any[]
      expect(content[0]).toEqual({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: "abc123data",
        },
      })
    })

    it("should combine text and image content", () => {
      const { messages } = prompt(
        <User>
          Describe this image:
          <File url="https://example.com/photo.png" />
        </User>,
      )

      const content = messages[0].content as any[]
      expect(content).toHaveLength(2)
      expect(content[0]).toEqual({ type: "text", text: "Describe this image:" })
      expect(content[1].type).toBe("image")
    })

    it("should handle multiple images", () => {
      const { messages } = prompt(
        <User>
          Compare:
          <File url="https://example.com/img1.png" />
          <File url="https://example.com/img2.png" />
        </User>,
      )

      const content = messages[0].content as any[]
      expect(content).toHaveLength(3)
      expect(content.filter((p: any) => p.type === "image")).toHaveLength(2)
    })
  })

  describe("document handling (PDFs)", () => {
    it("should format PDF with URL source", () => {
      const { messages } = prompt(
        <User>
          <File url="https://example.com/document.pdf" />
        </User>,
      )

      const content = messages[0].content as any[]
      expect(content[0]).toEqual({
        type: "document",
        source: {
          type: "url",
          url: "https://example.com/document.pdf",
        },
      })
    })

    it("should format PDF with base64 source", () => {
      const { messages } = prompt(
        <User>
          <File base64="pdfdata123" mimeType="application/pdf" />
        </User>,
      )

      const content = messages[0].content as any[]
      expect(content[0]).toEqual({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: "pdfdata123",
        },
      })
    })

    it("should fallback unsupported file types to text", () => {
      const { messages } = prompt(
        <User>
          <File base64="zipdata" mimeType="application/zip" filename="archive.zip" />
        </User>,
      )

      const content = messages[0].content as any[]
      expect(content[0]).toEqual({
        type: "text",
        text: "[File: archive.zip (application/zip)]",
      })
    })
  })

  describe("control flow components", () => {
    it("should correctly handle conditional rendering", () => {
      const isVip = true
      const { messages } = prompt(
        <User>
          Hello
          <If condition={isVip}> VIP!</If>
        </User>,
      )

      expect(messages[0].content).toBe("Hello VIP!")
    })

    it("should exclude false conditions", () => {
      const isVip = false
      const { messages } = prompt(
        <User>
          Hello
          <If condition={isVip}> VIP!</If>
        </User>,
      )

      expect(messages[0].content).toBe("Hello")
    })

    it("should handle Each for list rendering", () => {
      const items = ["a", "b", "c"]
      const { messages } = prompt(
        <User>
          <Each items={items}>{(item) => `${item}, `}</Each>
        </User>,
      )

      expect(messages[0].content).toContain("a")
      expect(messages[0].content).toContain("b")
      expect(messages[0].content).toContain("c")
    })
  })

  describe("data components", () => {
    it("should stringify JSON data", () => {
      const { messages } = prompt(
        <User>
          Data: <Json data={{ name: "Alice" }} />
        </User>,
      )

      expect(messages[0].content).toBe('Data: {"name":"Alice"}')
    })
  })

  describe("type safety", () => {
    it("should produce valid AnthropicOutput type", () => {
      const result: AnthropicOutput = prompt([<System>System</System>, <User>User</User>])

      expect(result.system).toBeDefined()
      expect(Array.isArray(result.messages)).toBe(true)
    })
  })

  describe("edge cases", () => {
    it("should handle empty prompt", () => {
      const result = prompt([])

      expect(result.system).toBeUndefined()
      expect(result.messages).toEqual([])
    })

    it("should handle only system message", () => {
      const result = prompt(<System>Just a system message</System>)

      expect(result.system).toBe("Just a system message")
      expect(result.messages).toEqual([])
    })

    it("should trim whitespace from content", () => {
      const { messages } = prompt(<User> Hello World </User>)

      expect(messages[0].content).toBe("Hello World")
    })

    it("should handle nested arrays in children", () => {
      const { messages } = prompt(
        <User>
          {[
            ["a", "b"],
            ["c", "d"],
          ]}
        </User>,
      )

      expect(messages[0].content).toBe("abcd")
    })
  })

  describe("Anthropic-specific format differences", () => {
    it("should use tool_use_id not tool_call_id in tool results", () => {
      const { messages } = prompt([<ToolResult id="toolu_abc">result</ToolResult>])

      const content = messages[0].content as any[]
      expect(content[0].tool_use_id).toBe("toolu_abc")
      expect(content[0].tool_call_id).toBeUndefined()
    })

    it("should use input not arguments in tool_use blocks", () => {
      const { messages } = prompt([<ToolCall id="toolu_1" name="test" args={{ key: "value" }} />])

      const content = messages[0].content as any[]
      expect(content[0].input).toEqual({ key: "value" })
      expect(content[0].function).toBeUndefined()
    })

    it("should NOT have role: system in messages array", () => {
      const { messages } = prompt([<System>System prompt</System>, <User>User message</User>])

      expect(messages.some((m) => (m as any).role === "system")).toBe(false)
    })

    it("should NOT have role: tool in messages array (uses user role)", () => {
      const { messages } = prompt(<ToolResult id="toolu_1">result</ToolResult>)

      expect(messages.some((m) => (m as any).role === "tool")).toBe(false)
      expect(messages[0].role).toBe("user")
    })
  })

  describe("WrapUser component", () => {
    it("should combine new content with existing user message in suffix mode", () => {
      const existingMessages: MessageParam[] = [{ role: "user", content: "What's the capital of France?" }]

      const { messages } = prompt(<WrapUser>Please respond in JSON format.</WrapUser>, { messages: existingMessages })

      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe("user")
      const content = (messages[0] as any).content
      expect(content).toContain("<user>")
      expect(content).toContain("What's the capital of France?")
      expect(content).toContain("</user>")
      expect(content).toContain("Please respond in JSON format.")
      // Suffix mode: new content comes after wrapped original
      expect(content.indexOf("</user>")).toBeLessThan(content.indexOf("Please respond in JSON format."))
    })

    it("should combine new content with existing user message in prefix mode", () => {
      const existingMessages: MessageParam[] = [{ role: "user", content: "Original question" }]

      const { messages } = prompt(<WrapUser mode="prefix">Context information:</WrapUser>, { messages: existingMessages })

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      // Prefix mode: new content comes before wrapped original
      expect(content.indexOf("Context information:")).toBeLessThan(content.indexOf("<user>"))
    })

    it("should use custom tag for wrapping original content", () => {
      const existingMessages: MessageParam[] = [{ role: "user", content: "My query" }]

      const { messages } = prompt(<WrapUser tag="original-query">Additional context</WrapUser>, { messages: existingMessages })

      const content = (messages[0] as any).content
      expect(content).toContain("<original-query>")
      expect(content).toContain("</original-query>")
      expect(content).not.toContain("<user>")
    })

    it("should find and modify only the last user message", () => {
      const existingMessages: MessageParam[] = [
        { role: "user", content: "First question" },
        { role: "assistant", content: "First answer" },
        { role: "user", content: "Follow-up question" },
      ]

      const { messages } = prompt(<WrapUser>Please be concise.</WrapUser>, { messages: existingMessages })

      expect(messages).toHaveLength(3)
      // First user message unchanged
      expect((messages[0] as any).content).toBe("First question")
      // Assistant message unchanged
      expect((messages[1] as any).content).toBe("First answer")
      // Last user message is modified
      expect((messages[2] as any).content).toContain("Follow-up question")
      expect((messages[2] as any).content).toContain("Please be concise.")
    })

    it("should create new user message when no existing user message in history", () => {
      // Anthropic doesn't allow system in messages array, so use assistant
      const existingMessages: MessageParam[] = [{ role: "assistant", content: "Hello!" }]

      const { messages } = prompt(<WrapUser>User query here</WrapUser>, { messages: existingMessages })

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe("assistant")
      expect(messages[1].role).toBe("user")
      expect((messages[1] as any).content).toBe("User query here")
    })

    it("should render as regular user message without messages option", () => {
      const { messages } = prompt(<WrapUser>Just content without history</WrapUser>)

      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe("user")
      expect((messages[0] as any).content).toBe("Just content without history")
    })

    it("should handle multiple WrapUser components with different modes", () => {
      const existingMessages: MessageParam[] = [{ role: "user", content: "Original" }]

      const { messages } = prompt(
        [
          <WrapUser mode="prefix" tag="context">
            Prefix content
          </WrapUser>,
          <WrapUser mode="suffix" tag="user">
            Suffix content
          </WrapUser>,
        ],
        { messages: existingMessages },
      )

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(content).toContain("Prefix content")
      expect(content).toContain("Original")
      expect(content).toContain("Suffix content")
      // Verify order: prefix < wrapped < suffix
      expect(content.indexOf("Prefix content")).toBeLessThan(content.indexOf("<user>"))
      expect(content.indexOf("</user>")).toBeLessThan(content.indexOf("Suffix content"))
    })

    it("should preserve non-WrapUser JSX messages", () => {
      const existingMessages: MessageParam[] = [{ role: "user", content: "Original" }]

      const { messages } = prompt([<WrapUser>Extra</WrapUser>, <Assistant>Got it!</Assistant>], { messages: existingMessages })

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe("user")
      expect(messages[1].role).toBe("assistant")
      expect((messages[1] as any).content).toBe("Got it!")
    })

    it("should handle complex JSX children in WrapUser", () => {
      const existingMessages: MessageParam[] = [{ role: "user", content: "Query" }]

      const { messages } = prompt(
        <WrapUser tag="context">
          <Group tag="instructions">Follow these rules carefully.</Group>
        </WrapUser>,
        { messages: existingMessages },
      )

      const content = (messages[0] as any).content
      expect(content).toContain("<instructions>")
      expect(content).toContain("Follow these rules carefully.")
      expect(content).toContain("</instructions>")
    })

    it("should handle existing messages with array content parts", () => {
      const existingMessages: MessageParam[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Part one." },
            { type: "text", text: " Part two." },
          ],
        },
      ]

      const { messages } = prompt(<WrapUser>Additional instruction</WrapUser>, { messages: existingMessages })

      const content = (messages[0] as any).content
      expect(content).toContain("Part one.")
      expect(content).toContain("Part two.")
      expect(content).toContain("Additional instruction")
    })

    it("should handle empty existing messages array", () => {
      const { messages } = prompt(<WrapUser>Content</WrapUser>, { messages: [] })

      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe("user")
      expect((messages[0] as any).content).toBe("Content")
    })

    it("should handle system messages separately from WrapUser", () => {
      const existingMessages: MessageParam[] = [{ role: "user", content: "Question" }]

      const { messages, system } = prompt([<System>You are helpful.</System>, <WrapUser>Extra context</WrapUser>], { messages: existingMessages })

      expect(system).toBe("You are helpful.")
      expect(messages).toHaveLength(1)
      expect((messages[0] as any).content).toContain("Question")
      expect((messages[0] as any).content).toContain("Extra context")
    })

    it("should evaluate conditional function children with hasUser=true when user message exists", () => {
      const existingMessages: MessageParam[] = [{ role: "user", content: "Hello" }]

      const { messages } = prompt(<WrapUser>{({ hasUser }) => (hasUser ? "Reply to the user's request above." : "No user context.")}</WrapUser>, {
        messages: existingMessages,
      })

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(content).toContain("Reply to the user's request above.")
      expect(content).not.toContain("No user context.")
    })

    it("should evaluate conditional function children with hasUser=false when no user message exists", () => {
      // Anthropic doesn't allow system in messages array, so use assistant
      const existingMessages: MessageParam[] = [{ role: "assistant", content: "Hello!" }]

      const { messages } = prompt(<WrapUser>{({ hasUser }) => (hasUser ? "Reply to the user's request above." : "No user context.")}</WrapUser>, {
        messages: existingMessages,
      })

      expect(messages).toHaveLength(2)
      const content = (messages[1] as any).content
      expect(content).toContain("No user context.")
      expect(content).not.toContain("Reply to the user's request above.")
    })

    it("should evaluate conditional function children with hasUser=false when no messages option", () => {
      const { messages } = prompt(<WrapUser>{({ hasUser }) => (hasUser ? "Has user" : "No user")}</WrapUser>)

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(content).toContain("No user")
      expect(content).not.toContain("Has user")
    })

    it("should combine static children with conditional function children", () => {
      const existingMessages: MessageParam[] = [{ role: "user", content: "Question" }]

      const { messages } = prompt(<WrapUser>Static prefix. {({ hasUser }) => (hasUser ? "With context." : "Without context.")}</WrapUser>, {
        messages: existingMessages,
      })

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(content).toContain("Static prefix.")
      expect(content).toContain("With context.")
    })

    it("should render JSX nodes returned from conditional functions", () => {
      const existingMessages: MessageParam[] = [{ role: "user", content: "Question" }]

      const { messages } = prompt(
        <WrapUser>
          {({ hasUser }) =>
            hasUser ? <Group tag="user-context">The user has provided input above.</Group> : <Group tag="no-context">No user input available.</Group>
          }
        </WrapUser>,
        { messages: existingMessages },
      )

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(content).toContain("<user-context>")
      expect(content).toContain("The user has provided input above.")
      expect(content).toContain("</user-context>")
      expect(content).not.toContain("<no-context>")
    })

    it("should handle null/undefined returns from conditional functions", () => {
      const existingMessages: MessageParam[] = [{ role: "user", content: "Question" }]

      const { messages } = prompt(<WrapUser>Base content.{({ hasUser }) => (hasUser ? null : "fallback")}</WrapUser>, { messages: existingMessages })

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(content).toContain("Base content.")
      expect(content).not.toContain("fallback")
    })

    it("should handle multiple conditional functions in sequence", () => {
      const existingMessages: MessageParam[] = [{ role: "user", content: "Question" }]

      const { messages } = prompt(
        <WrapUser>
          {({ hasUser }) => (hasUser ? "First condition. " : "")}
          {({ hasUser }) => (hasUser ? "Second condition." : "")}
        </WrapUser>,
        { messages: existingMessages },
      )

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(content).toContain("First condition.")
      expect(content).toContain("Second condition.")
    })

    it("should include File components from conditional functions when hasUser=true", () => {
      const existingMessages: MessageParam[] = [{ role: "user", content: "Describe this image" }]

      const { messages } = prompt(<WrapUser>{({ hasUser }) => (hasUser ? <File base64="base64imagedata" mimeType="image/png" /> : null)}</WrapUser>, {
        messages: existingMessages,
      })

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(Array.isArray(content)).toBe(true)
      // Should have text content and image part
      const textPart = content.find((p: any) => p.type === "text")
      const imagePart = content.find((p: any) => p.type === "image")
      expect(textPart).toBeDefined()
      expect(textPart.text).toContain("Describe this image")
      expect(imagePart).toBeDefined()
      expect(imagePart.source.type).toBe("base64")
      expect(imagePart.source.data).toBe("base64imagedata")
    })

    it("should include File components from conditional functions when hasUser=false", () => {
      const { messages } = prompt(
        <WrapUser>Analyze this:{({ hasUser }) => (hasUser ? null : <File base64="fallbackimage" mimeType="image/jpeg" />)}</WrapUser>,
      )

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(Array.isArray(content)).toBe(true)
      const textPart = content.find((p: any) => p.type === "text")
      const imagePart = content.find((p: any) => p.type === "image")
      expect(textPart.text).toContain("Analyze this:")
      expect(imagePart.source.data).toBe("fallbackimage")
    })

    it("should combine text and File from conditional functions", () => {
      const existingMessages: MessageParam[] = [{ role: "user", content: "Original" }]

      const { messages } = prompt(
        <WrapUser>
          {({ hasUser }) => (
            <>
              Here is context: <File base64="contextimage" mimeType="image/png" />
            </>
          )}
        </WrapUser>,
        { messages: existingMessages },
      )

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(Array.isArray(content)).toBe(true)
      const textPart = content.find((p: any) => p.type === "text")
      const imagePart = content.find((p: any) => p.type === "image")
      expect(textPart.text).toContain("Here is context:")
      expect(textPart.text).toContain("Original")
      expect(imagePart.source.data).toBe("contextimage")
    })
  })
})
