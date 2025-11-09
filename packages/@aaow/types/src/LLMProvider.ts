import { WorkflowNodeMessageType } from "./core";
import { Awaitable } from "./utils";

export interface LLMProvider {
  availableModels(): Awaitable<LLMModel[]>;
}

export interface LLMModel {
  name: string;
  description: string;
  getAgent(systemPrompt: string, tools: LLMTool[]): Awaitable<LLMAgent>;

  // system tools
  readTool(options?: LLMToolFileAccessOptions): Awaitable<LLMTool>; // read a file, optionally with line number range
  writeTool(options?: LLMToolFileAccessOptions): Awaitable<LLMTool>; // write a file
  replaceTool(options?: LLMToolFileAccessOptions): Awaitable<LLMTool>; // replace content of a file if exactly one match is found
  grepTool(options?: LLMToolFileAccessOptions): Awaitable<LLMTool>; // find files by content, optionally with line numbers
  listTool(options?: LLMToolFileAccessOptions): Awaitable<LLMTool>; // list directories and files
  findTool(options?: LLMToolFileAccessOptions): Awaitable<LLMTool>; // find files by path
  bashTool(options?: LLMToolBashOptions): Awaitable<LLMTool>; // run a bash command
  curlTool(options?: LLMToolCurlOptions): Awaitable<LLMTool>; // make an HTTP request
}

export interface LLMToolFileAccessOptions {
  allowedPathsInGlobPattern?: string[];
  excludedPathsInGlobPattern?: string[];
  allow?: (path: string) => boolean;
}

export interface LLMToolBashOptions {
  allowedArgsPatterns?: LLMToolBashOptionsArgsSegment[];
  allow?: (args: string[]) => boolean;
}

export type LLMToolBashOptionsArgsSegmentLiteral = string;

export interface LLMToolBashOptionsArgsSegmentString {
  type: "string";
  regex?: RegExp;
  allow?: (arg: string) => boolean;
}

export interface LLMToolBashOptionsArgsSegmentEnum {
  type: "enum";
  values: string[];
}

export interface LLMToolBashOptionsArgsSegmentAnything {
  type: "anything";
  allowRepeating?: boolean; // true means any number of any args is allowed
  // example: ["find", { type: "anything", allowRepeating: true }] allows `find / -delete`
}

export interface LLMToolBashOptionsArgsSegmentFilePath
  extends LLMToolFileAccessOptions {
  type: "filePath";
}

export interface LLMToolBashOptionsArgsSegmentOptional
  extends LLMToolFileAccessOptions {
  type: "optional";
  segments: LLMToolBashOptionsArgsSegment[];
  // for example: ["git", "checkout", { type: "optional", segments: ["-b"] }, { type: "anything" }]
}

export interface LLMToolBashOptionsArgsSegmentRepeat
  extends LLMToolFileAccessOptions {
  type: "repeat";
  segments: LLMToolBashOptionsArgsSegment[];
  // for example: ["docker", "run", { type: "repeat", segments: ["-p", { type: "anything" }] }, "hello-world"]
}

export type LLMToolBashOptionsArgsSegment =
  | LLMToolBashOptionsArgsSegmentLiteral
  | LLMToolBashOptionsArgsSegmentEnum
  | LLMToolBashOptionsArgsSegmentString
  | LLMToolBashOptionsArgsSegmentAnything
  | LLMToolBashOptionsArgsSegmentFilePath
  | LLMToolBashOptionsArgsSegmentOptional
  | LLMToolBashOptionsArgsSegmentRepeat;

export interface LLMToolCurlOptions {
  defaultHeaders?: (
    url: string,
    method: string
  ) => Awaitable<Record<string, string>>; // for authorization headers for custom services
  allowedMethods?: string[];
  allowedUrls?: string[];
  allow?: (
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string
  ) => boolean;
}

export interface LLMTool<
  InputSchema extends WorkflowNodeMessageType = WorkflowNodeMessageType
> {
  readonly opaque: unique symbol;
  inputSchema: InputSchema;
}

export interface LLMAgentInteractive {
  supportsInteractive: true;
  runInteractive(prompts: LLMPrompt[]): LLMInteractiveRunPromise;
  runNonInteractive(prompts: LLMPrompt[]): LLMNonInteractiveRunPromise;
}

export interface LLMAgentNonInteractive {
  supportsInteractive: false;
  runNonInteractive(prompts: LLMPrompt[]): LLMNonInteractiveRunPromise;
}

export type LLMAgent = LLMAgentInteractive | LLMAgentNonInteractive;

export interface LLMPromptText {
  type: "text";
  text: string;
}

export type LLMPrompt = LLMPromptText;

export interface LLMInteractiveRunPromise {
  messages: AsyncIterable<LLMInteractiveMessage>;
  postPrompt: (prompt: LLMPrompt) => Promise<void>;
  tryAbort: () => Promise<void>;
}

export interface LLMNonInteractiveRunPromise {
  text: Promise<LLMNonInteractiveRunResult>;
  tryAbort: () => Promise<void>;
}

export interface LLMNonInteractiveRunResultCompleted {
  completed: true;
  text: string;
}

export interface LLMNonInteractiveRunResultAborted {
  completed: false;
  text?: string;
}

export type LLMNonInteractiveRunResult =
  | LLMNonInteractiveRunResultCompleted
  | LLMNonInteractiveRunResultAborted;
