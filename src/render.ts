import { isElement } from "./element"
import { Fragment } from "./jsx-runtime"
import { isMessageType, getRoleFromType, MESSAGE_TYPES } from "./components/message"
import { CONTROL_TYPES } from "./components/control"
import { DATA_TYPES } from "./components/data"
import { NATIVE_TYPE } from "./components/native"
import { XML_TYPES } from "./components/xml"
import { WRAP_USER_TYPE } from "./components/wrap-user"
import type { PromptElement, PromptNode, IRMessage, IRToolCall, IRContentPart, Role, WrapUserConditionFn } from "./types"

/**
 * Intermediate representation of a message during rendering
 */
interface RenderMessage {
  role: Role
  content: string[]
  parts: IRContentPart[]
  toolCalls?: IRToolCall[]
  toolCallId?: string
  toolName?: string
  /** Structured JSON result for tool results */
  toolResultJson?: unknown
  /** Whether the tool result is an error */
  toolResultIsError?: boolean
  /** Whether this is native SDK content */
  isNative?: boolean
  /** Native SDK content to pass through */
  nativeContent?: unknown
  /** Whether this is a WrapUser component message */
  isWrapUser?: boolean
  /** Tag for wrapping original user content (for WrapUser) */
  wrapUserTag?: string
  /** Mode for positioning new content relative to original (for WrapUser) */
  wrapUserMode?: "prefix" | "suffix"
  /** Conditional render functions for WrapUser that need hasUser context */
  wrapUserConditions?: WrapUserConditionFn[]
}

/**
 * Renders JSX elements to an intermediate message array representation
 * This is the core internal render function used by all adapters
 */
export function renderToIR(node: PromptNode | PromptNode[]): IRMessage[] {
  const messages: RenderMessage[] = []

  // Handle multiple nodes (implicit fragment from prompt(...nodes))
  const nodesToProcess = Array.isArray(node) ? node : [node]
  for (const n of nodesToProcess) {
    processNode(n, messages, null)
  }

  // Convert to final IR format
  return messages.map((msg) => {
    // Handle native content - pass through with minimal processing
    if (msg.isNative) {
      return {
        role: msg.role,
        content: "",
        isNative: true,
        nativeContent: msg.nativeContent,
      }
    }

    const textContent = msg.content.join("").trim()

    const result: IRMessage = {
      role: msg.role,
      content: textContent,
    }

    // If there are file parts, build the parts array
    if (msg.parts.length > 0) {
      // Add text content as a text part if present
      const allParts: IRContentPart[] = []

      if (textContent) {
        allParts.push({ type: "text", text: textContent })
      }

      // Add file parts
      allParts.push(...msg.parts)

      result.parts = allParts
    }

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      result.toolCalls = msg.toolCalls
    }

    if (msg.toolCallId) {
      result.toolCallId = msg.toolCallId
    }

    if (msg.toolName) {
      result.toolName = msg.toolName
    }

    if (msg.toolResultJson !== undefined) {
      result.toolResultJson = msg.toolResultJson
    }

    if (msg.toolResultIsError) {
      result.toolResultIsError = true
    }

    // Include WrapUser fields
    if (msg.isWrapUser) {
      result.isWrapUser = true
      result.wrapUserTag = msg.wrapUserTag
      result.wrapUserMode = msg.wrapUserMode
      if (msg.wrapUserConditions && msg.wrapUserConditions.length > 0) {
        result.wrapUserConditions = msg.wrapUserConditions
      }
    }

    return result
  })
}

/**
 * Process a single node and add to messages
 */
function processNode(node: PromptNode, messages: RenderMessage[], currentRole: Role | null): void {
  // Handle null, undefined, boolean
  if (node === null || node === undefined || typeof node === "boolean") {
    return
  }

  // Handle strings and numbers - add to current message content
  if (typeof node === "string" || typeof node === "number") {
    if (currentRole !== null) {
      const currentMessage = messages[messages.length - 1]
      if (currentMessage && currentMessage.role === currentRole) {
        currentMessage.content.push(String(node))
      }
    }
    return
  }

  // Handle arrays
  if (Array.isArray(node)) {
    for (const child of node) {
      processNode(child, messages, currentRole)
    }
    return
  }

  // Handle elements
  if (isElement(node)) {
    processElement(node, messages, currentRole)
  }
}

/**
 * Process an LLM element
 */
function processElement(element: PromptElement, messages: RenderMessage[], currentRole: Role | null): void {
  const { type, children, props } = element

  // Handle Fragment
  if (type === "llm:fragment" || (typeof type === "symbol" && type === Fragment)) {
    for (const child of children) {
      processNode(child, messages, currentRole)
    }
    return
  }

  // Handle function components (call them and process result)
  if (typeof type === "function") {
    const result = type({ ...props, children })
    processNode(result, messages, currentRole)
    return
  }

  // Handle Native - pass through SDK-native content directly
  if (type === NATIVE_TYPE) {
    messages.push({
      role: "user", // Placeholder role, not used since isNative=true
      content: [],
      parts: [],
      isNative: true,
      nativeContent: props.content,
    })
    return
  }

  // Handle WrapUser - creates a special marker message for adapters
  if (type === WRAP_USER_TYPE) {
    const tag = String(props.tag || "user")
    const mode = (props.mode as "prefix" | "suffix") || "suffix"

    // Create a new user message with WrapUser markers
    const newMessage: RenderMessage = {
      role: "user",
      content: [],
      parts: [],
      isWrapUser: true,
      wrapUserTag: tag,
      wrapUserMode: mode,
    }

    messages.push(newMessage)

    // Process children with user role to collect the new content
    // Function children are stored for deferred evaluation with hasUser context
    // We insert placeholder markers to preserve the original child order
    for (const child of children) {
      if (typeof child === "function") {
        // Store function for deferred evaluation in adapters
        if (!newMessage.wrapUserConditions) {
          newMessage.wrapUserConditions = []
        }
        const idx = newMessage.wrapUserConditions.length
        // Insert placeholder to preserve position of function in content order
        newMessage.content.push(`\x00COND_${idx}\x00`)
        newMessage.wrapUserConditions.push(child as WrapUserConditionFn)
      } else {
        processNode(child, messages, "user")
      }
    }

    return
  }

  // Handle Group - wrap children in XML-style tags with indentation
  if (type === XML_TYPES.GROUP) {
    const tag = String(props.tag || "group")
    const indent = Number(props.indent) || 2
    const inline = Boolean(props.inline)

    if (currentRole !== null) {
      const currentMessage = messages[messages.length - 1]
      if (currentMessage && currentMessage.role === currentRole) {
        if (inline) {
          // Inline mode: no newlines or indentation, content flows immediately after
          currentMessage.content.push(`<${tag}>`)

          for (const child of children) {
            processNode(child, messages, currentRole)
          }

          currentMessage.content.push(`</${tag}>`)
        } else {
          // Block mode (default): newlines and indentation
          currentMessage.content.push(`<${tag}>\n`)

          // Render children to a temporary buffer to apply indentation
          const childMessages: RenderMessage[] = [
            {
              role: currentRole,
              content: [],
              parts: [],
            },
          ]

          for (const child of children) {
            processNode(child, childMessages, currentRole)
          }

          // Get the rendered child content, trim leading/trailing newlines, and indent each line
          const childContent = childMessages[0]?.content.join("")?.replace(/^\n+|\n+$/g, "") ?? ""
          const indentStr = " ".repeat(indent)
          const indentedContent = childContent
            .split("\n")
            .map((line) => (line ? indentStr + line : line))
            .join("\n")

          currentMessage.content.push(indentedContent)

          // Add closing tag
          currentMessage.content.push(`\n</${tag}>\n`)
        }
      }
    }
    return
  }

  // Handle ToolCall - creates or extends an assistant message
  if (type === MESSAGE_TYPES.TOOL_CALL) {
    const toolCall: IRToolCall = {
      id: String(props.id || ""),
      name: String(props.name || ""),
      args: (props.args as Record<string, unknown>) || {},
    }

    // Try to add to existing assistant message, or create a new one
    const lastMessage = messages[messages.length - 1]
    if (lastMessage && lastMessage.role === "assistant") {
      // Append to existing assistant message
      if (!lastMessage.toolCalls) {
        lastMessage.toolCalls = []
      }
      lastMessage.toolCalls.push(toolCall)
    } else {
      // Create new assistant message with tool call
      messages.push({
        role: "assistant",
        content: [],
        parts: [],
        toolCalls: [toolCall],
      })
    }
    return
  }

  // Handle message types (System, User, Assistant, ToolResult)
  if (typeof type === "string" && isMessageType(type)) {
    const role = getRoleFromType(type)
    if (role) {
      // Start a new message with this role
      const newMessage: RenderMessage = {
        role,
        content: [],
        parts: [],
      }

      // Add tool result props
      if (type === MESSAGE_TYPES.TOOL_RESULT && props) {
        if (props.id) newMessage.toolCallId = String(props.id)
        if (props.name) newMessage.toolName = String(props.name)
        if (props.json !== undefined) newMessage.toolResultJson = props.json
        if (props.isError) newMessage.toolResultIsError = true

        // Auto-detect single Json child for structured data
        if (props.json === undefined) {
          // Filter out whitespace-only text nodes
          const meaningfulChildren = children.filter((child) => {
            if (typeof child === "string") {
              return child.trim().length > 0
            }
            return child !== null && child !== undefined
          })

          if (meaningfulChildren.length === 1) {
            const jsonData = extractJsonData(meaningfulChildren[0])
            if (jsonData !== undefined) {
              newMessage.toolResultJson = jsonData
            }
          }
        }
      }

      messages.push(newMessage)

      // Process children with this role
      for (const child of children) {
        processNode(child, messages, role)
      }
    }
    return
  }

  // Handle data types (Json, File)
  if (typeof type === "string" && isDataType(type)) {
    if (currentRole !== null) {
      const currentMessage = messages[messages.length - 1]
      if (currentMessage && currentMessage.role === currentRole) {
        if (type === DATA_TYPES.JSON) {
          // Json just adds stringified content as text
          for (const child of children) {
            processNode(child, messages, currentRole)
          }
        } else if (type === DATA_TYPES.FILE) {
          // File adds a file part
          currentMessage.parts.push({
            type: props.type as "image" | "file",
            mimeType: String(props.mimeType || "application/octet-stream"),
            data: String(props.data || ""),
            isUrl: Boolean(props.isUrl),
            filename: props.filename ? String(props.filename) : undefined,
          })
        }
      }
    }
    return
  }

  // Handle control types (If, Show, Each, Linebreak)
  if (typeof type === "string" && isControlType(type)) {
    // Control types just pass through their children
    for (const child of children) {
      processNode(child, messages, currentRole)
    }
    return
  }

  // Unknown type - process children anyway
  for (const child of children) {
    processNode(child, messages, currentRole)
  }
}

/**
 * Check if a type is a control flow component
 */
function isControlType(type: string): boolean {
  return Object.values(CONTROL_TYPES).includes(type as (typeof CONTROL_TYPES)[keyof typeof CONTROL_TYPES])
}

/**
 * Check if a type is a data component
 */
function isDataType(type: string): boolean {
  return Object.values(DATA_TYPES).includes(type as (typeof DATA_TYPES)[keyof typeof DATA_TYPES])
}

/**
 * Check if a node is a Json element (either the raw element or a function component)
 * Returns the data if it's a Json element, undefined otherwise
 */
function extractJsonData(node: PromptNode): unknown | undefined {
  if (!isElement(node)) return undefined

  // Direct Json element (type is "llm:json" string)
  if (node.type === DATA_TYPES.JSON && "data" in node.props) {
    return node.props.data
  }

  // Function component that returns Json element - call it to get the result
  if (typeof node.type === "function" && "data" in node.props) {
    // This is a Json function component with data prop
    // The function signature matches Json(props: JsonProps)
    return node.props.data
  }

  return undefined
}

/**
 * Result of rendering content with both text and file parts
 */
export interface RenderContentResult {
  /** Text content */
  content: string
  /** File/image parts */
  parts: IRContentPart[]
}

/**
 * Renders JSX content to text and file parts.
 * Useful for rendering content fragments that may include File components.
 *
 * @example
 * const result = renderToContent(<>Hello <File type="image" data="..." mimeType="image/png" /></>)
 * // => { content: "Hello", parts: [{ type: "image", ... }] }
 */
export function renderToContent(node: PromptNode): RenderContentResult {
  // Create a temporary message structure to process the node
  const messages: RenderMessage[] = [
    {
      role: "user",
      content: [],
      parts: [],
    },
  ]

  // Process the node as if it were inside a user message
  const nodesToProcess = Array.isArray(node) ? node : [node]
  for (const n of nodesToProcess) {
    processNode(n, messages, "user")
  }

  // Return both content and parts
  return {
    content: messages[0].content.join(""),
    parts: messages[0].parts,
  }
}

/**
 * Renders JSX content to a plain string.
 * Useful for rendering content fragments (like schema instructions) to text.
 *
 * Note: This wraps the content in a temporary User message to render it,
 * then extracts the text content. File parts are discarded.
 *
 * @example
 * const text = renderToString(<Group tag="schema">content</Group>)
 * // => "<schema>\n  content\n</schema>\n"
 */
export function renderToString(node: PromptNode): string {
  return renderToContent(node).content
}
