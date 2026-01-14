/**
 * Tests for the Vercel AI SDK adapter
 * Ensures the adapter correctly produces AI SDK compatible message formats
 *
 * Key differences from OpenAI:
 * - Tool calls use toolCallId and toolName (camelCase)
 * - Tool results are CoreToolMessage with tool-result content blocks
 * - Images can be URL objects or base64 strings
 */
import { describe, it, expect } from "vitest"
import { prompt, System, User, Assistant, ToolResult, ToolCall, File, Json, If, Each, WrapUser, Group } from "./ai-sdk"
import type { ModelMessage } from "ai"

describe("AI SDK Adapter", () => {
  describe("basic message structure", () => {
    it("should return an array of ModelMessage", () => {
      const messages = prompt([<System>You are a helpful assistant.</System>, <User>Hello!</User>])

      expect(Array.isArray(messages)).toBe(true)
      expect(messages).toHaveLength(2)
    })

    it("should create system message with correct structure", () => {
      const messages = prompt(<System>System prompt here</System>)

      expect(messages[0]).toEqual({
        role: "system",
        content: "System prompt here",
      })
    })

    it("should create user message with correct structure", () => {
      const messages = prompt(<User>User message content</User>)

      expect(messages[0]).toEqual({
        role: "user",
        content: "User message content",
      })
    })

    it("should create assistant message with correct structure", () => {
      const messages = prompt(<Assistant>Assistant response</Assistant>)

      expect(messages[0]).toEqual({
        role: "assistant",
        content: "Assistant response",
      })
    })
  })

  describe("multi-turn conversations", () => {
    it("should handle a complete conversation flow", () => {
      const messages = prompt([
        <System>You are a helpful assistant.</System>,
        <User>What is 2+2?</User>,
        <Assistant>The answer is 4.</Assistant>,
        <User>Thanks!</User>,
        <Assistant>You are welcome!</Assistant>,
      ])

      expect(messages).toHaveLength(5)
      expect(messages[0]!.role).toBe("system")
      expect(messages[1]!.role).toBe("user")
      expect(messages[2]!.role).toBe("assistant")
      expect(messages[3]!.role).toBe("user")
      expect(messages[4]!.role).toBe("assistant")
    })

    it("should preserve message order", () => {
      const messages = prompt([<User>First</User>, <Assistant>Second</Assistant>, <User>Third</User>])

      expect(messages.map((m) => (m as any).content)).toEqual(["First", "Second", "Third"])
    })
  })

  describe("tool calls", () => {
    it("should create assistant message with tool-call content", () => {
      const messages = prompt(<ToolCall id="call_abc123" name="get_weather" input={{ city: "Tokyo" }} />)

      expect(messages).toHaveLength(1)
      const msg = messages[0] as any
      expect(msg.role).toBe("assistant")
      expect(Array.isArray(msg.content)).toBe(true)
    })

    it("should format tool-call correctly for AI SDK", () => {
      const messages = prompt(<ToolCall id="call_xyz" name="search" input={{ query: "weather" }} />)

      const msg = messages[0] as any
      expect(msg.content[0]).toEqual({
        type: "tool-call",
        toolCallId: "call_xyz",
        toolName: "search",
        input: { query: "weather" },
      })
    })

    it("should use camelCase properties (toolCallId, toolName, not snake_case)", () => {
      const messages = prompt(<ToolCall id="call_1" name="my_tool" input={{ data: "value" }} />)

      const msg = messages[0] as any
      const toolCall = msg.content[0]

      // Should be camelCase
      expect(toolCall.toolCallId).toBe("call_1")
      expect(toolCall.toolName).toBe("my_tool")

      // Should NOT have snake_case
      expect(toolCall.tool_call_id).toBeUndefined()
      expect(toolCall.tool_name).toBeUndefined()
    })

    it("should handle multiple tool calls", () => {
      const messages = prompt([<ToolCall id="call_1" name="tool_a" input={{ x: 1 }} />, <ToolCall id="call_2" name="tool_b" input={{ y: 2 }} />])

      expect(messages).toHaveLength(1)
      const msg = messages[0] as any
      expect(msg.content).toHaveLength(2)
      expect(msg.content[0].toolCallId).toBe("call_1")
      expect(msg.content[1].toolCallId).toBe("call_2")
    })

    it("should combine multiple adjacent tool calls into single assistant message", () => {
      const messages = prompt([
        <ToolCall id="call_a" name="get_weather" input={{ city: "Tokyo" }} />,
        <ToolCall id="call_b" name="get_time" input={{ timezone: "JST" }} />,
        <ToolCall id="call_c" name="get_currency" input={{ from: "USD", to: "JPY" }} />,
      ])

      // All three should be combined into one assistant message
      expect(messages).toHaveLength(1)
      expect(messages[0]!.role).toBe("assistant")

      const content = (messages[0] as any).content
      expect(content).toHaveLength(3)
      expect(content.every((c: any) => c.type === "tool-call")).toBe(true)
      expect(content[0].toolName).toBe("get_weather")
      expect(content[1].toolName).toBe("get_time")
      expect(content[2].toolName).toBe("get_currency")
    })

    it("should combine tool calls following an assistant message", () => {
      const messages = prompt([
        <Assistant>I'll help you with that. Let me check multiple things.</Assistant>,
        <ToolCall id="call_1" name="tool_a" input={{}} />,
        <ToolCall id="call_2" name="tool_b" input={{}} />,
        <ToolCall id="call_3" name="tool_c" input={{}} />,
      ])

      // All should be combined into one assistant message with text + 3 tool calls
      expect(messages).toHaveLength(1)
      const msg = messages[0] as any
      expect(msg.role).toBe("assistant")
      expect(msg.content).toHaveLength(4) // 1 text + 3 tool calls
      expect(msg.content[0].type).toBe("text")
      expect(msg.content[0].text).toBe("I'll help you with that. Let me check multiple things.")
      expect(msg.content[1].type).toBe("tool-call")
      expect(msg.content[2].type).toBe("tool-call")
      expect(msg.content[3].type).toBe("tool-call")
    })

    it("should not combine tool calls across different message boundaries", () => {
      const messages = prompt([
        <User>First request</User>,
        <ToolCall id="call_1" name="tool_a" input={{}} />,
        <User>Second request</User>,
        <ToolCall id="call_2" name="tool_b" input={{}} />,
      ])

      // Should be 4 separate messages
      expect(messages).toHaveLength(4)
      expect(messages[0]!.role).toBe("user")
      expect(messages[1]!.role).toBe("assistant")
      expect(messages[2]!.role).toBe("user")
      expect(messages[3]!.role).toBe("assistant")
    })

    it("should include text content before tool calls", () => {
      const messages = prompt([<Assistant>Let me look that up.</Assistant>, <ToolCall id="call_1" name="search" input={{}} />])

      expect(messages).toHaveLength(1)
      const msg = messages[0] as any
      expect(msg.content[0]).toEqual({ type: "text", text: "Let me look that up." })
      expect(msg.content[1].type).toBe("tool-call")
    })

    it("should keep input as object (not stringified like OpenAI)", () => {
      const input = { nested: { value: 42 }, array: [1, 2, 3] }
      const messages = prompt(<ToolCall id="call_1" name="complex_tool" input={input} />)

      const msg = messages[0] as any
      expect(msg.content[0].input).toEqual(input)
      expect(typeof msg.content[0].input).toBe("object")
    })
  })

  describe("tool results", () => {
    it("should create tool message with tool-result content", () => {
      const messages = prompt(
        <ToolResult id="call_abc123" name="get_weather">
          sunny
        </ToolResult>,
      )

      expect(messages).toHaveLength(1)
      const msg = messages[0] as any
      expect(msg.role).toBe("tool")
      expect(Array.isArray(msg.content)).toBe(true)
    })

    it("should format tool-result correctly for AI SDK", () => {
      const messages = prompt(
        <ToolResult id="call_xyz" name="search">
          search results
        </ToolResult>,
      )

      const msg = messages[0] as any
      expect(msg.content[0]).toEqual({
        type: "tool-result",
        toolCallId: "call_xyz",
        toolName: "search",
        output: { type: "text", value: "search results" },
      })
    })

    it("should use camelCase for toolCallId and toolName", () => {
      const messages = prompt(
        <ToolResult id="call_123" name="my_tool">
          result
        </ToolResult>,
      )

      const msg = messages[0] as any
      const toolResult = msg.content[0]

      expect(toolResult.toolCallId).toBe("call_123")
      expect(toolResult.toolName).toBe("my_tool")
      expect(toolResult.tool_call_id).toBeUndefined()
    })

    it("should handle full tool use flow", () => {
      const messages = prompt([
        <User>What is the weather?</User>,
        <ToolCall id="call_1" name="get_weather" input={{ city: "Tokyo" }} />,
        <ToolResult id="call_1" name="get_weather">
          {JSON.stringify({ temp: 22 })}
        </ToolResult>,
        <Assistant>It is 22 degrees in Tokyo.</Assistant>,
      ])

      expect(messages).toHaveLength(4)
      expect(messages[0]!.role).toBe("user")
      expect(messages[1]!.role).toBe("assistant")
      expect(messages[2]!.role).toBe("tool")
      expect(messages[3]!.role).toBe("assistant")
    })

    it("should keep multiple adjacent tool results as separate tool messages", () => {
      // In AI SDK, each tool result is a separate tool message
      const messages = prompt([
        <ToolResult id="call_1" name="get_weather">
          sunny
        </ToolResult>,
        <ToolResult id="call_2" name="get_time">
          12:00
        </ToolResult>,
        <ToolResult id="call_3" name="get_currency">
          150.5
        </ToolResult>,
      ])

      // Each tool result should be its own message
      expect(messages).toHaveLength(3)
      expect(messages.every((m) => m.role === "tool")).toBe(true)

      // Verify each has correct tool-result content
      expect((messages[0] as any).content[0].toolCallId).toBe("call_1")
      expect((messages[1] as any).content[0].toolCallId).toBe("call_2")
      expect((messages[2] as any).content[0].toolCallId).toBe("call_3")
    })

    it("should handle parallel tool calls followed by parallel tool results", () => {
      const messages = prompt([
        <User>Get weather and time for Tokyo</User>,
        <ToolCall id="call_1" name="get_weather" input={{ city: "Tokyo" }} />,
        <ToolCall id="call_2" name="get_time" input={{ city: "Tokyo" }} />,
        <ToolResult id="call_1" name="get_weather">
          sunny, 22°C
        </ToolResult>,
        <ToolResult id="call_2" name="get_time">
          14:30 JST
        </ToolResult>,
        <Assistant>In Tokyo, it's currently sunny and 22°C. The time is 14:30 JST.</Assistant>,
      ])

      expect(messages).toHaveLength(5)

      // User message
      expect(messages[0]!.role).toBe("user")

      // Combined tool calls in single assistant message
      expect(messages[1]!.role).toBe("assistant")
      expect((messages[1] as any).content).toHaveLength(2)
      expect((messages[1] as any).content[0].type).toBe("tool-call")
      expect((messages[1] as any).content[1].type).toBe("tool-call")

      // Separate tool results
      expect(messages[2]!.role).toBe("tool")
      expect((messages[2] as any).content[0].output).toEqual({ type: "text", value: "sunny, 22°C" })

      expect(messages[3]!.role).toBe("tool")
      expect((messages[3] as any).content[0].output).toEqual({ type: "text", value: "14:30 JST" })

      // Final assistant response
      expect(messages[4]!.role).toBe("assistant")
    })

    it("should maintain correct tool call and result correspondence", () => {
      const messages = prompt([
        <ToolCall id="weather_call" name="get_weather" input={{ city: "Paris" }} />,
        <ToolCall id="time_call" name="get_time" input={{ tz: "CET" }} />,
        <ToolResult id="weather_call" name="get_weather">
          cloudy
        </ToolResult>,
        <ToolResult id="time_call" name="get_time">
          15:00
        </ToolResult>,
      ])

      // Tool calls combined
      const assistantMsg = messages[0] as any
      expect(assistantMsg.content[0].toolCallId).toBe("weather_call")
      expect(assistantMsg.content[1].toolCallId).toBe("time_call")

      // Tool results maintain IDs
      const toolResult1 = messages[1] as any
      const toolResult2 = messages[2] as any
      expect(toolResult1.content[0].toolCallId).toBe("weather_call")
      expect(toolResult2.content[0].toolCallId).toBe("time_call")
    })
  })

  describe("multimodal content (images)", () => {
    it("should format image URL as URL object", () => {
      const messages = prompt(
        <User>
          <File url="https://example.com/image.png" />
        </User>,
      )

      const msg = messages[0] as any
      expect(msg.content[0].type).toBe("image")
      expect(msg.content[0].image).toBeInstanceOf(URL)
      expect(msg.content[0].image.href).toBe("https://example.com/image.png")
    })

    it("should format base64 image with mimeType", () => {
      const messages = prompt(
        <User>
          <File base64="abc123data" mimeType="image/jpeg" />
        </User>,
      )

      const msg = messages[0] as any
      expect(msg.content[0]).toEqual({
        type: "image",
        image: "abc123data",
        mediaType: "image/jpeg",
      })
    })

    it("should combine text and image content", () => {
      const messages = prompt(
        <User>
          Describe this image:
          <File url="https://example.com/photo.png" />
        </User>,
      )

      const msg = messages[0] as any
      expect(msg.content).toHaveLength(2)
      expect(msg.content[0]).toEqual({ type: "text", text: "Describe this image:" })
      expect(msg.content[1].type).toBe("image")
    })

    it("should handle multiple images", () => {
      const messages = prompt(
        <User>
          Compare:
          <File url="https://example.com/img1.png" />
          <File url="https://example.com/img2.png" />
        </User>,
      )

      const msg = messages[0] as any
      expect(msg.content).toHaveLength(3)
      expect(msg.content.filter((p: any) => p.type === "image")).toHaveLength(2)
    })
  })

  describe("file handling", () => {
    it("should format file with URL", () => {
      const messages = prompt(
        <User>
          <File url="https://example.com/document.pdf" />
        </User>,
      )

      const msg = messages[0] as any
      expect(msg.content[0].type).toBe("file")
      expect(msg.content[0].data).toBeInstanceOf(URL)
    })

    it("should format file with base64 data", () => {
      const messages = prompt(
        <User>
          <File base64="pdfdata123" mimeType="application/pdf" />
        </User>,
      )

      const msg = messages[0] as any
      expect(msg.content[0]).toEqual({
        type: "file",
        data: "pdfdata123",
        mediaType: "application/pdf",
      })
    })
  })

  describe("control flow components", () => {
    it("should correctly handle conditional rendering", () => {
      const isVip = true
      const messages = prompt(
        <User>
          Hello
          <If condition={isVip}> VIP!</If>
        </User>,
      )

      expect((messages[0] as any).content).toBe("Hello VIP!")
    })

    it("should exclude false conditions", () => {
      const isVip = false
      const messages = prompt(
        <User>
          Hello
          <If condition={isVip}> VIP!</If>
        </User>,
      )

      expect((messages[0] as any).content).toBe("Hello")
    })

    it("should handle Each for list rendering", () => {
      const items = ["x", "y", "z"]
      const messages = prompt(
        <User>
          <Each items={items}>{(item, idx) => `${idx}: ${item} `}</Each>
        </User>,
      )

      expect((messages[0] as any).content).toContain("0: x")
      expect((messages[0] as any).content).toContain("1: y")
      expect((messages[0] as any).content).toContain("2: z")
    })
  })

  describe("data components", () => {
    it("should stringify JSON data", () => {
      const messages = prompt(
        <User>
          Data: <Json data={{ key: "value" }} />
        </User>,
      )

      expect((messages[0] as any).content).toBe('Data: {"key":"value"}')
    })

    it("should handle pretty-printed JSON", () => {
      const messages = prompt(
        <User>
          <Json data={{ a: 1 }} pretty />
        </User>,
      )

      expect((messages[0] as any).content).toContain("\n")
    })
  })

  describe("type safety", () => {
    it("should produce valid ModelMessage types", () => {
      const messages: ModelMessage[] = prompt([<System>System</System>, <User>User</User>, <Assistant>Assistant</Assistant>])

      expect(messages.every((m) => "role" in m)).toBe(true)
    })
  })

  describe("system message ordering", () => {
    it("should place system message first even when defined after user message", () => {
      const messages = prompt([<User>Hello!</User>, <System>You are a helpful assistant.</System>])

      expect(messages).toHaveLength(2)
      expect(messages[0]!.role).toBe("system")
      expect(messages[1]!.role).toBe("user")
    })

    it("should place system message first in complex conversation", () => {
      const messages = prompt([
        <User>First question</User>,
        <Assistant>First answer</Assistant>,
        <System>System instructions</System>,
        <User>Second question</User>,
      ])

      expect(messages).toHaveLength(4)
      expect(messages[0]!.role).toBe("system")
      expect((messages[0] as any).content).toBe("System instructions")
      expect(messages[1]!.role).toBe("user")
      expect((messages[1] as any).content).toBe("First question")
    })

    it("should keep multiple system messages together at the start", () => {
      const messages = prompt([
        <User>Question</User>,
        <System>First system instruction</System>,
        <Assistant>Answer</Assistant>,
        <System>Second system instruction</System>,
      ])

      expect(messages).toHaveLength(3)
      expect(messages[0]!.role).toBe("system")
      expect(messages[0]!.content).toBe("First system instruction\n\nSecond system instruction")
      expect(messages[1]!.role).toBe("user")
      expect(messages[2]!.role).toBe("assistant")
    })

    it("should preserve relative order among system messages", () => {
      const messages = prompt([<System>First</System>, <User>Hello</User>, <System>Second</System>, <System>Third</System>])

      expect(messages).toHaveLength(2)
      expect(messages[0]!.role).toBe("system")
      expect(messages[0]!.content).toBe("First\n\nSecond\n\nThird")
      expect(messages[1]!.role).toBe("user")
      expect(messages[1]!.content).toBe("Hello")
    })

    it("should preserve relative order among non-system messages", () => {
      const messages = prompt([<User>Q1</User>, <System>System</System>, <Assistant>A1</Assistant>, <User>Q2</User>])

      expect(messages).toHaveLength(4)
      expect(messages[0]!.role).toBe("system")
      // Non-system messages should maintain their relative order
      expect((messages[1] as any).content).toBe("Q1")
      expect((messages[2] as any).content).toBe("A1")
      expect((messages[3] as any).content).toBe("Q2")
    })

    it("should handle single system message correctly", () => {
      const messages = prompt(<System>Only system</System>)

      expect(messages).toHaveLength(1)
      expect(messages[0]!.role).toBe("system")
    })

    it("should handle messages with no system message", () => {
      const messages = prompt([<User>Hello</User>, <Assistant>Hi there!</Assistant>])

      expect(messages).toHaveLength(2)
      expect(messages[0]!.role).toBe("user")
      expect(messages[1]!.role).toBe("assistant")
    })
  })

  describe("edge cases", () => {
    it("should handle empty prompt", () => {
      const messages = prompt([])

      expect(messages).toEqual([])
    })

    it("should trim whitespace from content", () => {
      const messages = prompt(<User> Spaced content </User>)

      expect((messages[0] as any).content).toBe("Spaced content")
    })

    it("should handle nested arrays in children", () => {
      const messages = prompt(
        <User>
          {[
            ["a", "b"],
            ["c", "d"],
          ]}
        </User>,
      )

      expect((messages[0] as any).content).toBe("abcd")
    })
  })

  describe("AI SDK-specific format differences", () => {
    it("should use tool-call type (with hyphen) not tool_call", () => {
      const messages = prompt(<ToolCall id="call_1" name="test" input={{}} />)

      const msg = messages[0] as any
      expect(msg.content[0].type).toBe("tool-call")
      expect(msg.content[0].type).not.toBe("tool_call")
    })

    it("should use tool-result type (with hyphen)", () => {
      const messages = prompt(
        <ToolResult id="call_1" name="test">
          result
        </ToolResult>,
      )

      const msg = messages[0] as any
      expect(msg.content[0].type).toBe("tool-result")
      expect(msg.content[0].type).not.toBe("tool_result")
    })

    it("should use output field with text type for tool results", () => {
      const messages = prompt(
        <ToolResult id="call_1" name="test">
          my result
        </ToolResult>,
      )

      const msg = messages[0] as any
      expect(msg.content[0].output).toEqual({ type: "text", value: "my result" })
    })

    it("should use json output type when json prop is provided", () => {
      const messages = prompt(<ToolResult id="call_1" name="get_weather" json={{ temperature: 22, condition: "sunny" }} />)

      const msg = messages[0] as any
      expect(msg.content[0].output).toEqual({
        type: "json",
        value: { temperature: 22, condition: "sunny" },
      })
    })

    it("should use error-text output type for text errors", () => {
      const messages = prompt(
        <ToolResult id="call_1" name="get_weather" isError>
          City not found
        </ToolResult>,
      )

      const msg = messages[0] as any
      expect(msg.content[0].output).toEqual({ type: "error-text", value: "City not found" })
    })

    it("should use error-json output type for json errors", () => {
      const messages = prompt(<ToolResult id="call_1" name="get_weather" json={{ code: 404, message: "Not found" }} isError />)

      const msg = messages[0] as any
      expect(msg.content[0].output).toEqual({
        type: "error-json",
        value: { code: 404, message: "Not found" },
      })
    })

    it("should auto-detect single Json child as structured output", () => {
      const messages = prompt(
        <ToolResult id="call_1" name="get_weather">
          <Json data={{ temperature: 22, condition: "sunny" }} />
        </ToolResult>,
      )

      const msg = messages[0] as any
      expect(msg.content[0].output).toEqual({
        type: "json",
        value: { temperature: 22, condition: "sunny" },
      })
    })

    it("should auto-detect single Json child with isError", () => {
      const messages = prompt(
        <ToolResult id="call_1" name="get_weather" isError>
          <Json data={{ code: 500, error: "Server error" }} />
        </ToolResult>,
      )

      const msg = messages[0] as any
      expect(msg.content[0].output).toEqual({
        type: "error-json",
        value: { code: 500, error: "Server error" },
      })
    })

    it("should keep role: tool (unlike Anthropic which uses user)", () => {
      const messages = prompt(
        <ToolResult id="call_1" name="test">
          result
        </ToolResult>,
      )

      expect(messages[0]!.role).toBe("tool")
      expect(messages[0]!.role).not.toBe("user")
    })

    it("should include toolName in tool results (required by AI SDK)", () => {
      const messages = prompt(
        <ToolResult id="call_1" name="search_tool">
          result
        </ToolResult>,
      )

      const msg = messages[0] as any
      expect(msg.content[0].toolName).toBe("search_tool")
    })
  })

  describe("WrapUser component", () => {
    it("should combine new content with existing user message in suffix mode", () => {
      const existingMessages: ModelMessage[] = [{ role: "user", content: "What's the capital of France?" }]

      const messages = prompt(<WrapUser>Please respond in JSON format.</WrapUser>, { messages: existingMessages })

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
      const existingMessages: ModelMessage[] = [{ role: "user", content: "Original question" }]

      const messages = prompt(<WrapUser mode="prefix">Context information:</WrapUser>, { messages: existingMessages })

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      // Prefix mode: new content comes before wrapped original
      expect(content.indexOf("Context information:")).toBeLessThan(content.indexOf("<user>"))
    })

    it("should use custom tag for wrapping original content", () => {
      const existingMessages: ModelMessage[] = [{ role: "user", content: "My query" }]

      const messages = prompt(<WrapUser tag="original-query">Additional context</WrapUser>, { messages: existingMessages })

      const content = (messages[0] as any).content
      expect(content).toContain("<original-query>")
      expect(content).toContain("</original-query>")
      expect(content).not.toContain("<user>")
    })

    it("should find and modify only the last user message", () => {
      const existingMessages: ModelMessage[] = [
        { role: "user", content: "First question" },
        { role: "assistant", content: "First answer" },
        { role: "user", content: "Follow-up question" },
      ]

      const messages = prompt(<WrapUser>Please be concise.</WrapUser>, { messages: existingMessages })

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
      const existingMessages: ModelMessage[] = [{ role: "system", content: "You are helpful." }]

      const messages = prompt(<WrapUser>User query here</WrapUser>, { messages: existingMessages })

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe("system")
      expect(messages[1].role).toBe("user")
      expect((messages[1] as any).content).toBe("User query here")
    })

    it("should render as regular user message without messages option", () => {
      const messages = prompt(<WrapUser>Just content without history</WrapUser>)

      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe("user")
      expect((messages[0] as any).content).toBe("Just content without history")
    })

    it("should handle multiple WrapUser components with different modes", () => {
      const existingMessages: ModelMessage[] = [{ role: "user", content: "Original" }]

      const messages = prompt(
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
      const existingMessages: ModelMessage[] = [{ role: "user", content: "Original" }]

      const messages = prompt([<WrapUser>Extra</WrapUser>, <Assistant>Got it!</Assistant>], { messages: existingMessages })

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe("user")
      expect(messages[1].role).toBe("assistant")
      expect((messages[1] as any).content).toBe("Got it!")
    })

    it("should handle complex JSX children in WrapUser", () => {
      const existingMessages: ModelMessage[] = [{ role: "user", content: "Query" }]

      const messages = prompt(
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
      const existingMessages: ModelMessage[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Part one." },
            { type: "text", text: " Part two." },
          ],
        },
      ]

      const messages = prompt(<WrapUser>Additional instruction</WrapUser>, { messages: existingMessages })

      const content = (messages[0] as any).content
      expect(content).toContain("Part one.")
      expect(content).toContain("Part two.")
      expect(content).toContain("Additional instruction")
    })

    it("should handle empty existing messages array", () => {
      const messages = prompt(<WrapUser>Content</WrapUser>, { messages: [] })

      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe("user")
      expect((messages[0] as any).content).toBe("Content")
    })

    it("should evaluate conditional function children with hasUser=true when user message exists", () => {
      const existingMessages: ModelMessage[] = [{ role: "user", content: "Hello" }]

      const messages = prompt(<WrapUser>{({ hasUser }) => (hasUser ? "Reply to the user's request above." : "No user context.")}</WrapUser>, {
        messages: existingMessages,
      })

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(content).toContain("Reply to the user's request above.")
      expect(content).not.toContain("No user context.")
    })

    it("should evaluate conditional function children with hasUser=false when no user message exists", () => {
      const existingMessages: ModelMessage[] = [{ role: "system", content: "You are helpful." }]

      const messages = prompt(<WrapUser>{({ hasUser }) => (hasUser ? "Reply to the user's request above." : "No user context.")}</WrapUser>, {
        messages: existingMessages,
      })

      expect(messages).toHaveLength(2)
      const content = (messages[1] as any).content
      expect(content).toContain("No user context.")
      expect(content).not.toContain("Reply to the user's request above.")
    })

    it("should evaluate conditional function children with hasUser=false when no messages option", () => {
      const messages = prompt(<WrapUser>{({ hasUser }) => (hasUser ? "Has user" : "No user")}</WrapUser>)

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(content).toContain("No user")
      expect(content).not.toContain("Has user")
    })

    it("should combine static children with conditional function children", () => {
      const existingMessages: ModelMessage[] = [{ role: "user", content: "Question" }]

      const messages = prompt(<WrapUser>Static prefix. {({ hasUser }) => (hasUser ? "With context." : "Without context.")}</WrapUser>, {
        messages: existingMessages,
      })

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(content).toContain("Static prefix.")
      expect(content).toContain("With context.")
    })

    it("should render JSX nodes returned from conditional functions", () => {
      const existingMessages: ModelMessage[] = [{ role: "user", content: "Question" }]

      const messages = prompt(
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
      const existingMessages: ModelMessage[] = [{ role: "user", content: "Question" }]

      const messages = prompt(<WrapUser>Base content.{({ hasUser }) => (hasUser ? null : "fallback")}</WrapUser>, { messages: existingMessages })

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(content).toContain("Base content.")
      expect(content).not.toContain("fallback")
    })

    it("should handle multiple conditional functions in sequence", () => {
      const existingMessages: ModelMessage[] = [{ role: "user", content: "Question" }]

      const messages = prompt(
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
      const existingMessages: ModelMessage[] = [{ role: "user", content: "Describe this image" }]

      const messages = prompt(<WrapUser>{({ hasUser }) => (hasUser ? <File base64="base64imagedata" mimeType="image/png" /> : null)}</WrapUser>, {
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
      expect(imagePart.image).toBe("base64imagedata")
    })

    it("should include File components from conditional functions when hasUser=false", () => {
      const messages = prompt(
        <WrapUser>Analyze this:{({ hasUser }) => (hasUser ? null : <File base64="fallbackimage" mimeType="image/jpeg" />)}</WrapUser>,
      )

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(Array.isArray(content)).toBe(true)
      const textPart = content.find((p: any) => p.type === "text")
      const imagePart = content.find((p: any) => p.type === "image")
      expect(textPart.text).toContain("Analyze this:")
      expect(imagePart.image).toBe("fallbackimage")
    })

    it("should combine text and File from conditional functions", () => {
      const existingMessages: ModelMessage[] = [{ role: "user", content: "Original" }]

      const messages = prompt(
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
      expect(imagePart.image).toBe("contextimage")
    })
  })
})
