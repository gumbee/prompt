/**
 * Tests for the core render functionality (renderToIR)
 */
import { describe, it, expect } from "vitest"
import { renderToIR } from "./render"
import { System, User, Assistant, ToolResult, ToolCall } from "./components/message"
import { If, Show, Each, Linebreak } from "./components/control"
import { Json, File } from "./components/data"
import { List, Item, Heading, Code, Bold, Italic, Strike, Quote, Hr } from "./components/markdown"
import { Group } from "./components/xml"
import { Native } from "./components/native"
import { createElement } from "./element"

describe("renderToIR", () => {
  describe("basic message rendering", () => {
    it("should render a simple system message", () => {
      const ir = renderToIR(<System>You are a helpful assistant.</System>)

      expect(ir).toHaveLength(1)
      expect(ir[0]).toEqual({
        role: "system",
        content: "You are a helpful assistant.",
      })
    })

    it("should render a simple user message", () => {
      const ir = renderToIR(<User>Hello!</User>)

      expect(ir).toHaveLength(1)
      expect(ir[0]).toEqual({
        role: "user",
        content: "Hello!",
      })
    })

    it("should render a simple assistant message", () => {
      const ir = renderToIR(<Assistant>Hi there!</Assistant>)

      expect(ir).toHaveLength(1)
      expect(ir[0]).toEqual({
        role: "assistant",
        content: "Hi there!",
      })
    })

    it("should render multiple messages", () => {
      const ir = renderToIR([<System>You are helpful.</System>, <User>Hi</User>, <Assistant>Hello!</Assistant>])

      expect(ir).toHaveLength(3)
      expect(ir[0].role).toBe("system")
      expect(ir[1].role).toBe("user")
      expect(ir[2].role).toBe("assistant")
    })

    it("should handle empty children", () => {
      const ir = renderToIR(<User>{undefined}</User>)

      expect(ir).toHaveLength(1)
      expect(ir[0].content).toBe("")
    })

    it("should handle numeric children", () => {
      const ir = renderToIR(<User>{42}</User>)

      expect(ir).toHaveLength(1)
      expect(ir[0].content).toBe("42")
    })

    it("should handle array children", () => {
      const ir = renderToIR(<User>Hello World</User>)

      expect(ir).toHaveLength(1)
      expect(ir[0].content).toBe("Hello World")
    })

    it("should filter out null and undefined children", () => {
      const ir = renderToIR(
        <User>
          Hello{null}
          {undefined}World
        </User>,
      )

      expect(ir).toHaveLength(1)
      expect(ir[0].content).toBe("HelloWorld")
    })

    it("should filter out boolean children", () => {
      const ir = renderToIR(
        <User>
          Hello{true}
          {false}World
        </User>,
      )

      expect(ir).toHaveLength(1)
      expect(ir[0].content).toBe("HelloWorld")
    })
  })

  describe("tool calls", () => {
    it("should render a tool call as part of assistant message", () => {
      const ir = renderToIR(<ToolCall id="call_123" name="get_weather" args={{ city: "Tokyo" }} />)

      expect(ir).toHaveLength(1)
      expect(ir[0].role).toBe("assistant")
      expect(ir[0].toolCalls).toHaveLength(1)
      expect(ir[0].toolCalls![0]).toEqual({
        id: "call_123",
        name: "get_weather",
        args: { city: "Tokyo" },
      })
    })

    it("should append tool call to existing assistant message", () => {
      const ir = renderToIR([
        <Assistant>Let me check the weather.</Assistant>,
        <ToolCall id="call_123" name="get_weather" args={{ city: "Tokyo" }} />,
      ])

      // Should combine into a single assistant message
      expect(ir).toHaveLength(1)
      expect(ir[0].role).toBe("assistant")
      expect(ir[0].content).toBe("Let me check the weather.")
      expect(ir[0].toolCalls).toHaveLength(1)
    })

    it("should handle multiple tool calls", () => {
      const ir = renderToIR([<ToolCall id="call_1" name="tool_a" args={{}} />, <ToolCall id="call_2" name="tool_b" args={{}} />])

      expect(ir).toHaveLength(1)
      expect(ir[0].toolCalls).toHaveLength(2)
    })
  })

  describe("tool results", () => {
    it("should render a tool result message", () => {
      const ir = renderToIR(
        <ToolResult id="call_123" name="get_weather">
          {'{"temp": 22}'}
        </ToolResult>,
      )

      expect(ir).toHaveLength(1)
      expect(ir[0].role).toBe("tool")
      expect(ir[0].content).toBe('{"temp": 22}')
      expect(ir[0].toolCallId).toBe("call_123")
      expect(ir[0].toolName).toBe("get_weather")
    })

    it("should render tool result with id only", () => {
      const ir = renderToIR(<ToolResult id="call_456">result data</ToolResult>)

      expect(ir[0].toolCallId).toBe("call_456")
      expect(ir[0].toolName).toBeUndefined()
    })
  })

  describe("control flow components", () => {
    it("should render If component when condition is true", () => {
      const ir = renderToIR(
        <User>
          <If condition={true}>Visible!</If>
        </User>,
      )

      expect(ir[0].content).toBe("Visible!")
    })

    it("should not render If component when condition is false", () => {
      const ir = renderToIR(
        <User>
          <If condition={false}>Hidden</If>
        </User>,
      )

      expect(ir[0].content).toBe("")
    })

    it("should render Show component with fallback", () => {
      const showTrue = renderToIR(
        <User>
          <Show when={true} fallback="Please log in">
            Logged in
          </Show>
        </User>,
      )
      const showFalse = renderToIR(
        <User>
          <Show when={false} fallback="Please log in">
            Logged in
          </Show>
        </User>,
      )

      expect(showTrue[0].content).toBe("Logged in")
      expect(showFalse[0].content).toBe("Please log in")
    })

    it("should render Each component", () => {
      const items = ["apple", "banana", "cherry"]
      const ir = renderToIR(
        <User>
          <Each items={items}>{(item, idx) => `${idx + 1}. ${item}`}</Each>
        </User>,
      )

      expect(ir[0].content).toContain("1. apple")
      expect(ir[0].content).toContain("2. banana")
      expect(ir[0].content).toContain("3. cherry")
    })

    it("should render Linebreak", () => {
      const ir = renderToIR(
        <User>
          Hello
          <Linebreak />
          World
        </User>,
      )

      expect(ir[0].content).toBe("Hello\nWorld")
    })

    it("should render multiple Linebreaks", () => {
      const ir = renderToIR(
        <User>
          Hello
          <Linebreak repeat={2} />
          World
        </User>,
      )

      expect(ir[0].content).toBe("Hello\n\nWorld")
    })
  })

  describe("data components", () => {
    it("should render Json component", () => {
      const ir = renderToIR(
        <User>
          <Json data={{ name: "Alice", age: 30 }} />
        </User>,
      )

      expect(ir[0].content).toBe('{"name":"Alice","age":30}')
    })

    it("should render Json with pretty print", () => {
      const ir = renderToIR(
        <User>
          <Json data={{ name: "Alice" }} pretty />
        </User>,
      )

      expect(ir[0].content).toContain("\n")
      expect(ir[0].content).toContain("  ")
    })

    it("should render File component with URL", () => {
      const ir = renderToIR(
        <User>
          <File url="https://example.com/image.png" />
        </User>,
      )

      expect(ir[0].parts).toHaveLength(1)
      expect(ir[0].parts![0]).toMatchObject({
        type: "image",
        data: "https://example.com/image.png",
        isUrl: true,
        mimeType: "image/png",
      })
    })

    it("should render File component with base64 data", () => {
      const ir = renderToIR(
        <User>
          <File base64="abc123" mimeType="image/jpeg" />
        </User>,
      )

      expect(ir[0].parts).toHaveLength(1)
      expect(ir[0].parts![0]).toMatchObject({
        type: "image",
        data: "abc123",
        isUrl: false,
        mimeType: "image/jpeg",
      })
    })

    it("should render PDF file", () => {
      const ir = renderToIR(
        <User>
          <File base64="pdf-data" mimeType="application/pdf" filename="doc.pdf" />
        </User>,
      )

      expect(ir[0].parts![0]).toMatchObject({
        type: "file",
        mimeType: "application/pdf",
        filename: "doc.pdf",
      })
    })

    it("should include text content as first part when file is present", () => {
      const ir = renderToIR(
        <User>
          What is in this image?
          <File url="https://example.com/photo.jpg" />
        </User>,
      )

      expect(ir[0].parts).toHaveLength(2)
      expect(ir[0].parts![0]).toEqual({ type: "text", text: "What is in this image?" })
      expect(ir[0].parts![1].type).toBe("image")
    })
  })

  describe("markdown components", () => {
    // Note: Final message content is trimmed, so trailing newlines from block elements
    // are stripped when the element is alone. The newlines are preserved when composing
    // multiple elements together - see 'block element composition' tests below.

    it("should render List component", () => {
      const ir = renderToIR(
        <User>
          <List>
            <Item>One</Item>
            <Item>Two</Item>
          </List>
        </User>,
      )

      // Trailing newline is trimmed from final content
      expect(ir[0].content).toBe("- One\n- Two")
    })

    it("should render ordered List", () => {
      const ir = renderToIR(
        <User>
          <List ordered>
            <Item>First</Item>
            <Item>Second</Item>
          </List>
        </User>,
      )

      expect(ir[0].content).toBe("1. First\n2. Second")
    })

    it("should render Heading", () => {
      const ir = renderToIR(
        <User>
          <Heading>Title</Heading>
        </User>,
      )

      // Trailing newline is trimmed from final content
      expect(ir[0].content).toBe("## Title")
    })

    it("should render Heading with custom level", () => {
      const ir = renderToIR(
        <User>
          <Heading level={3}>Subtitle</Heading>
        </User>,
      )

      expect(ir[0].content).toBe("### Subtitle")
    })

    it("should render Code inline", () => {
      const ir = renderToIR(
        <User>
          <Code inline>myFunc()</Code>
        </User>,
      )

      expect(ir[0].content).toBe("`myFunc()`")
    })

    it("should render Code block", () => {
      const ir = renderToIR(
        <User>
          <Code lang="typescript">const x = 42;</Code>
        </User>,
      )

      // Trailing newline is trimmed from final content
      expect(ir[0].content).toBe("```typescript\nconst x = 42;\n```")
    })

    it("should render Bold text", () => {
      const ir = renderToIR(
        <User>
          <Bold>important</Bold>
        </User>,
      )

      expect(ir[0].content).toBe("**important**")
    })

    it("should render Italic text", () => {
      const ir = renderToIR(
        <User>
          <Italic>emphasis</Italic>
        </User>,
      )

      expect(ir[0].content).toBe("*emphasis*")
    })

    it("should render Strike text", () => {
      const ir = renderToIR(
        <User>
          <Strike>deleted</Strike>
        </User>,
      )

      expect(ir[0].content).toBe("~~deleted~~")
    })

    it("should render Quote", () => {
      const ir = renderToIR(
        <User>
          <Quote>A famous quote</Quote>
        </User>,
      )

      // Trailing newline is trimmed from final content
      expect(ir[0].content).toBe("> A famous quote")
    })

    it("should render Hr", () => {
      const ir = renderToIR(
        <User>
          <Hr />
        </User>,
      )

      // Trailing newline is trimmed from final content
      expect(ir[0].content).toBe("---")
    })

    // Block element composition tests - these verify that block elements properly
    // separate from following content. This is the key behavior we're testing:
    // block elements must include trailing newlines so composition works correctly.
    describe("block elements are properly separated from following content", () => {
      it("should separate heading from following text", () => {
        const ir = renderToIR(
          <User>
            <Heading>Title</Heading>
            Some text after the heading
          </User>,
        )

        // The newline from the heading separates it from the following text
        expect(ir[0].content).toBe("## Title\nSome text after the heading")
      })

      it("should separate list from following text", () => {
        const ir = renderToIR(
          <User>
            <List>
              <Item>Item one</Item>
              <Item>Item two</Item>
            </List>
            Text after the list
          </User>,
        )

        expect(ir[0].content).toBe("- Item one\n- Item two\nText after the list")
      })

      it("should separate quote from following text", () => {
        const ir = renderToIR(
          <User>
            <Quote>A quote</Quote>
            Text after the quote
          </User>,
        )

        expect(ir[0].content).toBe("> A quote\nText after the quote")
      })

      it("should separate hr from following text", () => {
        const ir = renderToIR(
          <User>
            <Hr />
            Text after the rule
          </User>,
        )

        expect(ir[0].content).toBe("---\nText after the rule")
      })

      it("should separate code block from following text", () => {
        const ir = renderToIR(
          <User>
            <Code lang="js">const x = 1;</Code>
            Text after code
          </User>,
        )

        expect(ir[0].content).toBe("```js\nconst x = 1;\n```\nText after code")
      })

      it("should compose multiple block elements correctly", () => {
        const ir = renderToIR(
          <User>
            <Heading level={1}>Main Title</Heading>
            <List>
              <Item>First</Item>
              <Item>Second</Item>
            </List>
            <Hr />
            <Quote>A wise quote</Quote>
            Final paragraph
          </User>,
        )

        expect(ir[0].content).toBe("# Main Title\n" + "- First\n- Second\n" + "---\n" + "> A wise quote\n" + "Final paragraph")
      })

      it("should separate heading from following heading", () => {
        const ir = renderToIR(
          <User>
            <Heading level={1}>Main Title</Heading>
            <Heading level={2}>Subtitle</Heading>
          </User>,
        )

        expect(ir[0].content).toBe("# Main Title\n## Subtitle")
      })

      it("should separate list from following list", () => {
        const ir = renderToIR(
          <User>
            <List>
              <Item>First list item</Item>
            </List>
            <List ordered>
              <Item>Second list item</Item>
            </List>
          </User>,
        )

        expect(ir[0].content).toBe("- First list item\n1. Second list item")
      })
    })
  })

  describe("fragments and nesting", () => {
    it("should handle fragment elements", () => {
      const ir = renderToIR(
        <User>
          <>Hello World</>
        </User>,
      )

      expect(ir[0].content).toBe("Hello World")
    })

    it("should handle nested messages correctly", () => {
      // Each message type should create a separate message
      const ir = renderToIR([
        <System>System prompt</System>,
        <User>User message</User>,
        <Assistant>Assistant reply</Assistant>,
        <User>Follow up</User>,
      ])

      expect(ir).toHaveLength(4)
      expect(ir.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"])
    })
  })

  describe("function components", () => {
    it("should render custom function components", () => {
      function Greeting({ name }: { name: string }) {
        return <>Hello, {name}!</>
      }

      const ir = renderToIR(
        <User>
          <Greeting name="Alice" />
        </User>,
      )

      expect(ir[0].content).toBe("Hello, Alice!")
    })

    it("should handle nested function components", () => {
      function Wrapper({ children }: { children: any }) {
        return <>[{children}]</>
      }

      function Inner() {
        return <>content</>
      }

      const ir = renderToIR(
        <User>
          <Wrapper>
            <Inner />
          </Wrapper>
        </User>,
      )

      expect(ir[0].content).toBe("[content]")
    })
  })

  describe("Group component", () => {
    it("should wrap content in XML-style tags", () => {
      const ir = renderToIR(
        <User>
          <Group tag="schema">content here</Group>
        </User>,
      )

      expect(ir[0].content).toBe("<schema>\n  content here\n</schema>")
    })

    it("should indent content with default 2 spaces", () => {
      const ir = renderToIR(
        <User>
          <Group tag="data">line one</Group>
        </User>,
      )

      expect(ir[0].content).toContain("  line one")
    })

    it("should respect custom indent prop", () => {
      const ir = renderToIR(
        <User>
          <Group tag="code" indent={4}>
            indented content
          </Group>
        </User>,
      )

      expect(ir[0].content).toContain("    indented content")
    })

    it("should handle multi-line content with proper indentation", () => {
      const multiLineContent = "line one\nline two\nline three"
      const ir = renderToIR(
        <User>
          <Group tag="block">{multiLineContent}</Group>
        </User>,
      )

      expect(ir[0].content).toBe("<block>\n  line one\n  line two\n  line three\n</block>")
    })

    it("should work with nested JSX components", () => {
      const ir = renderToIR(
        <User>
          <Group tag="wrapper">
            <Bold>important</Bold>
          </Group>
        </User>,
      )

      expect(ir[0].content).toBe("<wrapper>\n  **important**\n</wrapper>")
    })

    it("should handle nested Group components", () => {
      const ir = renderToIR(
        <User>
          <Group tag="outer">
            <Group tag="inner">nested content</Group>
          </Group>
        </User>,
      )

      // Inner group gets indented by outer group
      expect(ir[0].content).toContain("<outer>")
      expect(ir[0].content).toContain("<inner>")
      expect(ir[0].content).toContain("nested content")
      expect(ir[0].content).toContain("</inner>")
      expect(ir[0].content).toContain("</outer>")
    })

    it("should compose with markdown components", () => {
      const ir = renderToIR(
        <User>
          <Group tag="instructions">
            <Heading level={2}>Title</Heading>
            Some content
          </Group>
        </User>,
      )

      expect(ir[0].content).toContain("<instructions>")
      expect(ir[0].content).toContain("## Title")
      expect(ir[0].content).toContain("Some content")
      expect(ir[0].content).toContain("</instructions>")
    })

    it("should render inline without internal newlines or indentation", () => {
      const ir = renderToIR(
        <User>
          <Group tag="name" inline>
            John Doe
          </Group>
        </User>,
      )

      expect(ir[0].content).toBe("<name>John Doe</name>")
    })

    it("should add trailing newline in block mode for block separation", () => {
      const ir = renderToIR(
        <User>
          <Group tag="name">John</Group>
          <Group tag="age">30</Group>
        </User>,
      )

      expect(ir[0].content).toBe("<name>\n  John\n</name>\n<age>\n  30\n</age>")
    })

    it("should render inline with nested components", () => {
      const ir = renderToIR(
        <User>
          <Group tag="emphasis" inline>
            <Bold>important</Bold>
          </Group>
        </User>,
      )

      expect(ir[0].content).toBe("<emphasis>**important**</emphasis>")
    })

    it("should ignore indent prop when inline", () => {
      const ir = renderToIR(
        <User>
          <Group tag="data" inline indent={4}>
            content
          </Group>
        </User>,
      )

      // No indentation should be applied in inline mode
      expect(ir[0].content).toBe("<data>content</data>")
    })

    it("should not separate inline Group from subsequent content", () => {
      const ir = renderToIR(
        <User>
          <Group tag="header" inline>
            Title
          </Group>
          More content here
        </User>,
      )

      expect(ir[0].content).toBe("<header>Title</header>More content here")
    })

    it("should separate block Group from subsequent content", () => {
      const ir = renderToIR(
        <User>
          <Group tag="header">Title</Group>
          More content here
        </User>,
      )

      expect(ir[0].content).toBe("<header>\n  Title\n</header>\nMore content here")
    })
  })

  describe("Native component", () => {
    it("should store native content in IR with isNative flag", () => {
      const nativeContent = { role: "user", content: "native message" }
      const ir = renderToIR(<Native content={nativeContent} />)

      expect(ir).toHaveLength(1)
      expect(ir[0].isNative).toBe(true)
      expect(ir[0].nativeContent).toEqual(nativeContent)
    })

    it("should preserve complex native content structures", () => {
      const nativeContent = {
        role: "user",
        content: [
          { type: "text", text: "Hello" },
          { type: "image", source: { type: "url", url: "https://example.com/img.png" } },
        ],
      }
      const ir = renderToIR(<Native content={nativeContent} />)

      expect(ir[0].isNative).toBe(true)
      expect(ir[0].nativeContent).toEqual(nativeContent)
    })

    it("should work alongside regular JSX messages", () => {
      const nativeContent = { role: "assistant", content: "native reply" }
      const ir = renderToIR([<User>Hello</User>, <Native content={nativeContent} />, <User>Follow up</User>])

      expect(ir).toHaveLength(3)
      expect(ir[0].role).toBe("user")
      expect(ir[0].content).toBe("Hello")
      expect(ir[1].isNative).toBe(true)
      expect(ir[1].nativeContent).toEqual(nativeContent)
      expect(ir[2].role).toBe("user")
      expect(ir[2].content).toBe("Follow up")
    })
  })
})
