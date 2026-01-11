import { createElement } from "../element"
import type { PromptElement } from "../types"

/**
 * Internal data component type identifiers
 */
export const DATA_TYPES = {
  JSON: "llm:json",
  FILE: "llm:file",
} as const

// ============================================================================
// Json Component
// ============================================================================

export interface JsonProps {
  /** The data to stringify */
  data: unknown
  /** Pretty print with indentation (default: false) */
  pretty?: boolean
  /** Indentation spaces when pretty printing (default: 2) */
  indent?: number
}

/**
 * Json component - automatically stringifies data
 *
 * @example
 * <User>
 *   Here is the data:
 *   <Json data={{ name: "Alice", age: 30 }} />
 * </User>
 * // Content: Here is the data: {"name":"Alice","age":30}
 *
 * @example
 * <User>
 *   <Json data={userData} pretty />
 * </User>
 * // Content:
 * // {
 * //   "name": "Alice",
 * //   "age": 30
 * // }
 *
 * @example Within ToolResult (auto-detected as structured JSON)
 * <ToolResult id="call_1" name="get_weather">
 *   <Json data={{ temp: 22 }} />
 * </ToolResult>
 * // Output uses { type: "json", value: { temp: 22 } } for AI SDK
 */
export function Json(props: JsonProps): PromptElement {
  const { data, pretty = false, indent = 2 } = props
  const content = pretty ? JSON.stringify(data, null, indent) : JSON.stringify(data)
  // Store original data for extraction by ToolResult
  return createElement(DATA_TYPES.JSON, { data }, content)
}

// ============================================================================
// File Component
// ============================================================================

export interface FileProps {
  /** URL to the file/image */
  url?: string
  /** Base64-encoded file data (without data: prefix) */
  base64?: string
  /** MIME type (required for base64, inferred for URLs) */
  mimeType?: string
  /** Optional filename */
  filename?: string
}

/**
 * File component - adds file/image content to messages
 * Supports both URLs and base64-encoded data
 *
 * @example
 * // Image from URL
 * <User>
 *   What's in this image?
 *   <File url="https://example.com/image.png" />
 * </User>
 *
 * @example
 * // Image from base64
 * <User>
 *   Analyze this image:
 *   <File base64={imageData} mimeType="image/png" />
 * </User>
 *
 * @example
 * // PDF file
 * <User>
 *   Summarize this document:
 *   <File base64={pdfData} mimeType="application/pdf" filename="report.pdf" />
 * </User>
 */
export function File(props: FileProps): PromptElement {
  const { url, base64, mimeType, filename } = props

  if (!url && !base64) {
    throw new Error("File component requires either 'url' or 'base64' prop")
  }

  if (base64 && !mimeType) {
    throw new Error("File component requires 'mimeType' when using 'base64'")
  }

  // Determine if this is an image based on mimeType
  const isImage = mimeType?.startsWith("image/") ?? (url ? /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url) : false)

  return createElement(DATA_TYPES.FILE, {
    type: isImage ? "image" : "file",
    data: url || base64,
    isUrl: !!url,
    mimeType: mimeType || inferMimeType(url),
    filename,
  })
}

/**
 * Infer MIME type from URL extension
 */
function inferMimeType(url?: string): string {
  if (!url) return "application/octet-stream"

  const ext = url.split(".").pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    // Images
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    // Documents
    pdf: "application/pdf",
    // Audio
    mp3: "audio/mpeg",
    wav: "audio/wav",
    // Video
    mp4: "video/mp4",
    webm: "video/webm",
  }

  return mimeTypes[ext || ""] || "application/octet-stream"
}

/**
 * Check if a type is a data component
 */
export function isDataType(type: string): boolean {
  return Object.values(DATA_TYPES).includes(type as (typeof DATA_TYPES)[keyof typeof DATA_TYPES])
}
