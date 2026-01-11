# Data Helpers

Components for working with structured data in prompts.

## Json

Automatically stringify JavaScript objects and arrays. Cleaner than manual `JSON.stringify()`.

```tsx
import { User, Json, prompt } from "@gumbee/prompt/openai"

function UserDataPrompt({ userData }: { userData: object }) {
  return (
    <User>
      Here is the user data:
      <Json data={userData} />
    </User>
  )
}

const messages = prompt(<UserDataPrompt userData={{ name: "Alice", age: 30, skills: ["TypeScript", "React"] }} />)
// User content: 'Here is the user data: {"name":"Alice","age":30,"skills":["TypeScript","React"]}'
```

### Pretty Printing

Use `pretty` prop for formatted JSON with indentation:

```tsx
function ConfigAnalyzer({ config }: { config: object }) {
  return (
    <User>
      Analyze this configuration:
      <Json data={config} pretty />
    </User>
  )
}

const messages = prompt(<ConfigAnalyzer config={{ key: "value" }} />)
// User content: 'Analyze this configuration:\n{\n  "key": "value"\n}'
```

### Custom Indentation

Control indentation with the `indent` prop:

```tsx
<Json data={data} pretty indent={4} />
```

### Props

| Prop     | Type      | Default | Description                                 |
| :------- | :-------- | :------ | :------------------------------------------ |
| `data`   | `unknown` | -       | The data to stringify (required)            |
| `pretty` | `boolean` | `false` | Pretty print with newlines and indentation  |
| `indent` | `number`  | `2`     | Spaces for indentation when pretty printing |

### Auto-Detection in ToolResult

When a `<Json>` component is the only child of a `<ToolResult>`, it's automatically detected as structured JSON output. This is especially useful for the AI SDK adapter, which uses the proper `{ type: "json", value: ... }` output format:

```tsx
import { ToolResult, Json, prompt } from "@gumbee/prompt/ai-sdk"

// These are equivalent:
<ToolResult id="call_1" name="get_weather" json={{ temp: 22 }} />

<ToolResult id="call_1" name="get_weather">
  <Json data={{ temp: 22 }} />
</ToolResult>

// Both produce: { type: "tool-result", output: { type: "json", value: { temp: 22 } } }
```

This auto-detection only works when `<Json>` is the **only** meaningful child (whitespace is ignored). If there's other text content, the result is treated as text.

## File

Add file or image content to messages. Supports both URLs and base64-encoded data.

### Image from URL

```tsx
import { User, File, prompt } from "@gumbee/prompt/openai"

function ImageQuestion({ imageUrl }: { imageUrl: string }) {
  return (
    <User>
      What's in this image?
      <File url={imageUrl} />
    </User>
  )
}

const messages = prompt(<ImageQuestion imageUrl="https://example.com/photo.png" />)
```

### Image from Base64

```tsx
import { User, File, prompt } from "@gumbee/prompt/openai"
import { readFileSync } from "fs"

function ImageDescription({ imageData }: { imageData: string }) {
  return (
    <User>
      Describe this image:
      <File base64={imageData} mimeType="image/png" />
    </User>
  )
}

const imageData = readFileSync("image.png").toString("base64")
const messages = prompt(<ImageDescription imageData={imageData} />)
```

### PDF Document

```tsx
import { User, File, prompt } from "@gumbee/prompt/anthropic"
import { readFileSync } from "fs"

function DocumentSummary({ pdfData, filename }: { pdfData: string; filename: string }) {
  return (
    <User>
      Summarize this document:
      <File base64={pdfData} mimeType="application/pdf" filename={filename} />
    </User>
  )
}

const pdfData = readFileSync("report.pdf").toString("base64")
const { system, messages } = prompt(<DocumentSummary pdfData={pdfData} filename="quarterly-report.pdf" />)
```

### Props

| Prop       | Type     | Description                                                 |
| :--------- | :------- | :---------------------------------------------------------- |
| `url`      | `string` | URL to the file/image (use this OR `base64`)                |
| `base64`   | `string` | Base64-encoded file data without `data:` prefix             |
| `mimeType` | `string` | MIME type (required when using `base64`, inferred for URLs) |
| `filename` | `string` | Optional filename for the attachment                        |

### Adapter Output

Each adapter formats file content according to its SDK:

| Adapter   | Image Format                                | Document Format                                |
| :-------- | :------------------------------------------ | :--------------------------------------------- |
| OpenAI    | `{ type: "image_url", image_url: { url } }` | Text fallback                                  |
| AI SDK    | `{ type: "image", image: url \| data }`     | `{ type: "file", data, mimeType }`             |
| Anthropic | `{ type: "image", source: { type, data } }` | `{ type: "document", source: { type, data } }` |

### Supported MIME Types

**Images (all adapters):**

- `image/jpeg`
- `image/png`
- `image/gif`
- `image/webp`

**Documents (adapter-dependent):**

- `application/pdf` (Anthropic, AI SDK)

**Note:** OpenAI currently only supports images via the API. Non-image files fall back to a text description.

## Combining Data Components

Use `Json` and `File` together for rich prompts:

```tsx
import { System, User, Json, File, prompt } from "@gumbee/prompt/openai"

interface AnalysisRequest {
  focus: string[]
  outputFormat: string
}

function ImageAnalysis({ request, imageUrl }: { request: AnalysisRequest; imageUrl: string }) {
  return (
    <>
      <System>You are an expert image analyst.</System>
      <User>
        Analyze this image according to these parameters:
        <Json data={request} pretty />
        Image:
        <File url={imageUrl} />
      </User>
    </>
  )
}

const messages = prompt(
  <ImageAnalysis request={{ focus: ["colors", "composition", "mood"], outputFormat: "detailed" }} imageUrl="https://example.com/artwork.jpg" />,
)
```

## Type Exports

```tsx
import type { JsonProps, FileProps } from "@gumbee/prompt"

interface JsonProps {
  data: unknown
  pretty?: boolean
  indent?: number
}

interface FileProps {
  url?: string
  base64?: string
  mimeType?: string
  filename?: string
}
```
