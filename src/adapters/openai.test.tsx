/**
 * Tests for the OpenAI adapter
 * Ensures the adapter correctly produces OpenAI SDK compatible message formats
 */
import { describe, it, expect } from "vitest"
import { prompt, System, User, Assistant, ToolResult, ToolCall, File, Json, If, Each, WrapUser, Group } from "./openai"
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"

describe("OpenAI Adapter", () => {
  describe("basic message structure", () => {
    it("should return an array of ChatCompletionMessageParam", () => {
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
      expect(messages[0].role).toBe("system")
      expect(messages[1].role).toBe("user")
      expect(messages[2].role).toBe("assistant")
      expect(messages[3].role).toBe("user")
      expect(messages[4].role).toBe("assistant")
    })

    it("should preserve message order", () => {
      const messages = prompt([<User>First</User>, <Assistant>Second</Assistant>, <User>Third</User>])

      expect(messages.map((m) => (m as any).content)).toEqual(["First", "Second", "Third"])
    })
  })

  describe("tool calls (function calling)", () => {
    it("should create assistant message with tool_calls array", () => {
      const messages = prompt(<ToolCall id="call_abc123" name="get_weather" input={{ city: "Tokyo" }} />)

      expect(messages).toHaveLength(1)
      const msg = messages[0] as any
      expect(msg.role).toBe("assistant")
      expect(msg.tool_calls).toBeDefined()
      expect(msg.tool_calls).toHaveLength(1)
    })

    it("should format tool_calls correctly for OpenAI", () => {
      const messages = prompt(<ToolCall id="call_xyz" name="search" input={{ query: "weather" }} />)

      const msg = messages[0] as any
      expect(msg.tool_calls[0]).toEqual({
        id: "call_xyz",
        type: "function",
        function: {
          name: "search",
          arguments: JSON.stringify({ query: "weather" }),
        },
      })
    })

    it("should handle multiple tool calls in sequence", () => {
      const messages = prompt([<ToolCall id="call_1" name="tool_a" input={{ x: 1 }} />, <ToolCall id="call_2" name="tool_b" input={{ y: 2 }} />])

      // Should combine into single assistant message with multiple tool_calls
      expect(messages).toHaveLength(1)
      const msg = messages[0] as any
      expect(msg.tool_calls).toHaveLength(2)
      expect(msg.tool_calls[0].id).toBe("call_1")
      expect(msg.tool_calls[1].id).toBe("call_2")
    })

    it("should include content with tool calls when text is present", () => {
      const messages = prompt([<Assistant>Let me check that for you.</Assistant>, <ToolCall id="call_1" name="lookup" input={{}} />])

      // Should be combined into single assistant message
      expect(messages).toHaveLength(1)
      const msg = messages[0] as any
      expect(msg.role).toBe("assistant")
      expect(msg.content).toBe("Let me check that for you.")
      expect(msg.tool_calls).toHaveLength(1)
    })

    it("should handle empty input", () => {
      const messages = prompt(<ToolCall id="call_empty" name="no_args" input={{}} />)

      const msg = messages[0] as any
      expect(msg.tool_calls[0].function.arguments).toBe("{}")
    })

    it("should handle complex input", () => {
      const complexArgs = {
        nested: { deeply: { value: 42 } },
        array: [1, 2, 3],
        nullable: null,
        boolean: true,
      }

      const messages = prompt(<ToolCall id="call_complex" name="complex_tool" input={complexArgs} />)

      const msg = messages[0] as any
      expect(msg.tool_calls[0].function.arguments).toBe(JSON.stringify(complexArgs))
    })
  })

  describe("tool results", () => {
    it("should create tool message with correct structure", () => {
      const messages = prompt(<ToolResult id="call_abc123">{'{"result": "sunny"}'}</ToolResult>)

      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual({
        role: "tool",
        content: '{"result": "sunny"}',
        tool_call_id: "call_abc123",
      })
    })

    it("should handle tool result in conversation context", () => {
      const messages = prompt([
        <User>What is the weather in Tokyo?</User>,
        <ToolCall id="call_1" name="get_weather" input={{ city: "Tokyo" }} />,
        <ToolResult id="call_1">{JSON.stringify({ temp: 22, condition: "sunny" })}</ToolResult>,
        <Assistant>The weather in Tokyo is sunny with 22°C.</Assistant>,
      ])

      expect(messages).toHaveLength(4)
      expect(messages[0].role).toBe("user")
      expect(messages[1].role).toBe("assistant")
      expect(messages[2].role).toBe("tool")
      expect(messages[3].role).toBe("assistant")
    })

    it("should handle multiple tool results", () => {
      const messages = prompt([
        <ToolCall id="call_1" name="tool_a" input={{}} />,
        <ToolCall id="call_2" name="tool_b" input={{}} />,
        <ToolResult id="call_1">result_a</ToolResult>,
        <ToolResult id="call_2">result_b</ToolResult>,
      ])

      expect(messages).toHaveLength(3) // 1 assistant with 2 tool_calls, 2 tool results
      const toolMessages = messages.filter((m) => m.role === "tool")
      expect(toolMessages).toHaveLength(2)
    })
  })

  describe("multimodal content (images)", () => {
    it("should convert image URL to content array format", () => {
      const messages = prompt(
        <User>
          What is in this image?
          <File url="https://example.com/image.png" />
        </User>,
      )

      expect(messages).toHaveLength(1)
      const msg = messages[0] as any
      expect(msg.role).toBe("user")
      expect(Array.isArray(msg.content)).toBe(true)
    })

    it("should format image_url correctly for URL images", () => {
      const messages = prompt(
        <User>
          <File url="https://example.com/photo.jpg" />
        </User>,
      )

      const msg = messages[0] as any
      expect(msg.content).toContainEqual({
        type: "image_url",
        image_url: { url: "https://example.com/photo.jpg" },
      })
    })

    it("should format base64 images with data URL", () => {
      const messages = prompt(
        <User>
          <File base64="abc123base64data" mimeType="image/png" />
        </User>,
      )

      const msg = messages[0] as any
      expect(msg.content[0]).toEqual({
        type: "image_url",
        image_url: { url: "data:image/png;base64,abc123base64data" },
      })
    })

    it("should combine text and image parts correctly", () => {
      const messages = prompt(
        <User>
          Describe this image:
          <File url="https://example.com/image.png" />
        </User>,
      )

      const msg = messages[0] as any
      expect(msg.content).toHaveLength(2)
      expect(msg.content[0]).toEqual({ type: "text", text: "Describe this image:" })
      expect(msg.content[1].type).toBe("image_url")
    })

    it("should handle multiple images", () => {
      const messages = prompt(
        <User>
          Compare these images:
          <File url="https://example.com/image1.png" />
          <File url="https://example.com/image2.png" />
        </User>,
      )

      const msg = messages[0] as any
      expect(msg.content).toHaveLength(3) // 1 text + 2 images
      expect(msg.content.filter((p: any) => p.type === "image_url")).toHaveLength(2)
    })

    it("should fallback non-image files to text description", () => {
      const messages = prompt(
        <User>
          <File base64="pdfdata" mimeType="application/pdf" filename="doc.pdf" />
        </User>,
      )

      const msg = messages[0] as any
      expect(msg.content[0]).toEqual({
        type: "text",
        text: "[File: doc.pdf (application/pdf)]",
      })
    })
  })

  describe("control flow components", () => {
    it("should correctly handle conditional rendering", () => {
      const isVip = true
      const messages = prompt(
        <User>
          Hello
          <If condition={isVip}> VIP member!</If>
        </User>,
      )

      expect((messages[0] as any).content).toBe("Hello VIP member!")
    })

    it("should exclude false conditions", () => {
      const isVip = false
      const messages = prompt(
        <User>
          Hello
          <If condition={isVip}> VIP member!</If>
        </User>,
      )

      expect((messages[0] as any).content).toBe("Hello")
    })

    it("should handle Each for list rendering", () => {
      const items = ["apple", "banana", "cherry"]
      const messages = prompt(
        <User>
          <Each items={items}>{(item, idx) => `${idx + 1}. ${item}\n`}</Each>
        </User>,
      )

      expect((messages[0] as any).content).toContain("1. apple")
      expect((messages[0] as any).content).toContain("2. banana")
      expect((messages[0] as any).content).toContain("3. cherry")
    })
  })

  describe("data components", () => {
    it("should stringify JSON data", () => {
      const messages = prompt(
        <User>
          Here is the data: <Json data={{ name: "Alice", age: 30 }} />
        </User>,
      )

      expect((messages[0] as any).content).toBe('Here is the data: {"name":"Alice","age":30}')
    })

    it("should handle pretty-printed JSON", () => {
      const messages = prompt(
        <User>
          <Json data={{ x: 1 }} pretty />
        </User>,
      )

      expect((messages[0] as any).content).toContain("\n")
    })
  })

  describe("type safety", () => {
    it("should produce valid ChatCompletionMessageParam types", () => {
      const messages: ChatCompletionMessageParam[] = prompt([<System>System</System>, <User>User</User>, <Assistant>Assistant</Assistant>])

      // This test primarily ensures type compatibility at compile time
      expect(messages.every((m) => "role" in m)).toBe(true)
    })
  })

  describe("system message ordering", () => {
    it("should place system message first even when defined after user message", () => {
      const messages = prompt([<User>Hello!</User>, <System>You are a helpful assistant.</System>])

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe("system")
      expect(messages[1].role).toBe("user")
    })

    it("should place system message first in complex conversation", () => {
      const messages = prompt([
        <User>First question</User>,
        <Assistant>First answer</Assistant>,
        <System>System instructions</System>,
        <User>Second question</User>,
      ])

      expect(messages).toHaveLength(4)
      expect(messages[0].role).toBe("system")
      expect((messages[0] as any).content).toBe("System instructions")
      expect(messages[1].role).toBe("user")
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
      expect(messages[0].role).toBe("system")
      expect(messages[0].content).toBe("First system instruction\n\nSecond system instruction")
      expect(messages[1].role).toBe("user")
      expect(messages[2].role).toBe("assistant")
    })

    it("should preserve relative order among system messages", () => {
      const messages = prompt([<System>First</System>, <User>Hello</User>, <System>Second</System>, <System>Third</System>])

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe("system")
      expect((messages[0] as any).content).toBe("First\n\nSecond\n\nThird")
      expect(messages[1].role).toBe("user")
      expect((messages[1] as any).content).toBe("Hello")
    })

    it("should preserve relative order among non-system messages", () => {
      const messages = prompt([<User>Q1</User>, <System>System</System>, <Assistant>A1</Assistant>, <User>Q2</User>])

      expect(messages).toHaveLength(4)
      expect(messages[0].role).toBe("system")
      // Non-system messages should maintain their relative order
      expect((messages[1] as any).content).toBe("Q1")
      expect((messages[2] as any).content).toBe("A1")
      expect((messages[3] as any).content).toBe("Q2")
    })

    it("should handle single system message correctly", () => {
      const messages = prompt(<System>Only system</System>)

      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe("system")
    })

    it("should handle messages with no system message", () => {
      const messages = prompt([<User>Hello</User>, <Assistant>Hi there!</Assistant>])

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe("user")
      expect(messages[1].role).toBe("assistant")
    })
  })

  describe("edge cases", () => {
    it("should handle empty prompt", () => {
      const messages = prompt([])

      expect(messages).toEqual([])
    })

    it("should handle assistant message with null content when only tool calls", () => {
      const messages = prompt(<ToolCall id="call_1" name="tool" input={{}} />)

      const msg = messages[0] as any
      // Content should be null or empty when no text content
      expect(msg.content === null || msg.content === "").toBe(true)
    })

    it("should trim whitespace from message content", () => {
      const messages = prompt(<User> Hello World </User>)

      expect((messages[0] as any).content).toBe("Hello World")
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

  describe("WrapUser component", () => {
    it("should combine new content with existing user message in suffix mode", () => {
      const existingMessages: ChatCompletionMessageParam[] = [{ role: "user", content: "What's the capital of France?" }]

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
      const existingMessages: ChatCompletionMessageParam[] = [{ role: "user", content: "Original question" }]

      const messages = prompt(<WrapUser mode="prefix">Context information:</WrapUser>, { messages: existingMessages })

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      // Prefix mode: new content comes before wrapped original
      expect(content.indexOf("Context information:")).toBeLessThan(content.indexOf("<user>"))
    })

    it("should use custom tag for wrapping original content", () => {
      const existingMessages: ChatCompletionMessageParam[] = [{ role: "user", content: "My query" }]

      const messages = prompt(<WrapUser tag="original-query">Additional context</WrapUser>, { messages: existingMessages })

      const content = (messages[0] as any).content
      expect(content).toContain("<original-query>")
      expect(content).toContain("</original-query>")
      expect(content).not.toContain("<user>")
    })

    it("should find and modify only the last user message", () => {
      const existingMessages: ChatCompletionMessageParam[] = [
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
      const existingMessages: ChatCompletionMessageParam[] = [{ role: "system", content: "You are helpful." }]

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
      const existingMessages: ChatCompletionMessageParam[] = [{ role: "user", content: "Original" }]

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
      const existingMessages: ChatCompletionMessageParam[] = [{ role: "user", content: "Original" }]

      const messages = prompt([<WrapUser>Extra</WrapUser>, <Assistant>Got it!</Assistant>], { messages: existingMessages })

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe("user")
      expect(messages[1].role).toBe("assistant")
      expect((messages[1] as any).content).toBe("Got it!")
    })

    it("should handle complex JSX children in WrapUser", () => {
      const existingMessages: ChatCompletionMessageParam[] = [{ role: "user", content: "Query" }]

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
      const existingMessages: ChatCompletionMessageParam[] = [
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
      const existingMessages: ChatCompletionMessageParam[] = [{ role: "user", content: "Hello" }]

      const messages = prompt(<WrapUser>{({ hasUser }) => (hasUser ? "Reply to the user's request above." : "No user context.")}</WrapUser>, {
        messages: existingMessages,
      })

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(content).toContain("Reply to the user's request above.")
      expect(content).not.toContain("No user context.")
    })

    it("should evaluate conditional function children with hasUser=false when no user message exists", () => {
      const existingMessages: ChatCompletionMessageParam[] = [{ role: "system", content: "You are helpful." }]

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
      const existingMessages: ChatCompletionMessageParam[] = [{ role: "user", content: "Question" }]

      const messages = prompt(<WrapUser>Static prefix. {({ hasUser }) => (hasUser ? "With context." : "Without context.")}</WrapUser>, {
        messages: existingMessages,
      })

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(content).toContain("Static prefix.")
      expect(content).toContain("With context.")
    })

    it("should render JSX nodes returned from conditional functions", () => {
      const existingMessages: ChatCompletionMessageParam[] = [{ role: "user", content: "Question" }]

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
      const existingMessages: ChatCompletionMessageParam[] = [{ role: "user", content: "Question" }]

      const messages = prompt(<WrapUser>Base content.{({ hasUser }) => (hasUser ? null : "fallback")}</WrapUser>, { messages: existingMessages })

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(content).toContain("Base content.")
      expect(content).not.toContain("fallback")
    })

    it("should handle multiple conditional functions in sequence", () => {
      const existingMessages: ChatCompletionMessageParam[] = [{ role: "user", content: "Question" }]

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
      const existingMessages: ChatCompletionMessageParam[] = [{ role: "user", content: "Describe this image" }]

      const messages = prompt(<WrapUser>{({ hasUser }) => (hasUser ? <File base64="base64imagedata" mimeType="image/png" /> : null)}</WrapUser>, {
        messages: existingMessages,
      })

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(Array.isArray(content)).toBe(true)
      // Should have text content and image part
      const textPart = content.find((p: any) => p.type === "text")
      const imagePart = content.find((p: any) => p.type === "image_url")
      expect(textPart).toBeDefined()
      expect(textPart.text).toContain("Describe this image")
      expect(imagePart).toBeDefined()
      expect(imagePart.image_url.url).toContain("base64imagedata")
    })

    it("should include File components from conditional functions when hasUser=false", () => {
      const messages = prompt(
        <WrapUser>Analyze this:{({ hasUser }) => (hasUser ? null : <File base64="fallbackimage" mimeType="image/jpeg" />)}</WrapUser>,
      )

      expect(messages).toHaveLength(1)
      const content = (messages[0] as any).content
      expect(Array.isArray(content)).toBe(true)
      const textPart = content.find((p: any) => p.type === "text")
      const imagePart = content.find((p: any) => p.type === "image_url")
      expect(textPart.text).toContain("Analyze this:")
      expect(imagePart.image_url.url).toContain("fallbackimage")
    })

    it("should combine text and File from conditional functions", () => {
      const existingMessages: ChatCompletionMessageParam[] = [{ role: "user", content: "Original" }]

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
      const imagePart = content.find((p: any) => p.type === "image_url")
      expect(textPart.text).toContain("Here is context:")
      expect(textPart.text).toContain("Original")
      expect(imagePart.image_url.url).toContain("contextimage")
    })
  })
})
