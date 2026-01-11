/**
 * Prompt module - core JSX prompt building functionality
 */

// Components
export { System, User, Assistant, ToolResult, ToolCall, MESSAGE_TYPES, isMessageType, getRoleFromType } from "./components/message"
export type { ToolResultProps, ToolCallProps } from "./components/message"
export { If, Show, Each, Linebreak, CONTROL_TYPES } from "./components/control"
export type { LinebreakProps } from "./components/control"
export { List, Item, Heading, Code, Bold, Italic, Strike, Quote, Hr } from "./components/markdown"
export type { ListProps, ItemProps, HeadingProps, CodeProps, TextProps } from "./components/markdown"
export { Json, File, DATA_TYPES, isDataType } from "./components/data"
export type { JsonProps, FileProps } from "./components/data"
export { Group, XML_TYPES, isXmlType, wrapXml } from "./components/xml"
export type { GroupProps, WrapXmlOptions } from "./components/xml"
export { Native, NATIVE_TYPE, isNativeType } from "./components/native"
export type { NativeProps } from "./components/native"
export { WrapUser, WRAP_USER_TYPE, isWrapUserType } from "./components/wrap-user"
export type { WrapUserProps, WrapUserMode, WrapUserCondition, WrapUserContext } from "./components/wrap-user"

// Core
export { renderToIR, renderToString } from "./render"
export { createElement, isElement } from "./element"
export type {
  PromptElement as LLMElement,
  PromptNode as PromptNode,
  Role,
  MessageProps,
  IfProps,
  ShowProps,
  EachProps,
  IRMessage,
  IRToolCall,
  IRFilePart,
  IRContentPart,
} from "./types"
