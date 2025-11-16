import type { Awaitable } from "./utils";

/**
 * File access constraints for file-related tools
 * Used to restrict which files can be read, written, or modified
 */
export interface FileAccessOptions {
  /** Allowed file paths in glob pattern format */
  allowedPathsInGlobPattern?: string[];

  /** Excluded file paths in glob pattern format */
  excludedPathsInGlobPattern?: string[];

  /** Custom validation function for file paths */
  allow?: (path: string) => boolean;
}

/**
 * Bash command execution constraints
 * Used to restrict which commands and arguments can be executed
 */
export interface BashOptions {
  /** Allowed command argument patterns */
  allowedArgsPatterns?: BashArgsSegment[];

  /** Custom validation function for command arguments */
  allow?: (args: string[]) => boolean;

  /** Maximum execution time in milliseconds */
  timeout?: number;

  /** Working directory for command execution */
  cwd?: string;

  /** Environment variables for command execution */
  env?: Record<string, string>;
}

/**
 * Represents a literal string argument
 */
export type BashArgsSegmentLiteral = string;

/**
 * Represents a string argument with optional validation
 */
export interface BashArgsSegmentString {
  type: "string";
  /** Regular expression to validate the argument */
  regex?: RegExp;
  /** Custom validation function */
  allow?: (arg: string) => boolean;
}

/**
 * Represents an enum argument - must be one of the specified values
 */
export interface BashArgsSegmentEnum {
  type: "enum";
  /** Allowed values */
  values: string[];
}

/**
 * Represents any argument(s)
 */
export interface BashArgsSegmentAnything {
  type: "anything";
  /** Allow any number of arguments after this point */
  allowRepeating?: boolean;
  // Example: ["find", { type: "anything", allowRepeating: true }] allows `find / -delete`
}

/**
 * Represents a file path argument with file access constraints
 */
export interface BashArgsSegmentFilePath extends FileAccessOptions {
  type: "filePath";
}

/**
 * Represents optional arguments
 */
export interface BashArgsSegmentOptional {
  type: "optional";
  /** Argument segments that are optional */
  segments: BashArgsSegment[];
  // Example: ["git", "checkout", { type: "optional", segments: ["-b"] }, { type: "anything" }]
}

/**
 * Represents repeating arguments
 */
export interface BashArgsSegmentRepeat {
  type: "repeat";
  /** Argument segments that can be repeated */
  segments: BashArgsSegment[];
  // Example: ["docker", "run", { type: "repeat", segments: ["-p", { type: "anything" }] }, "hello-world"]
}

/**
 * Union type for all bash argument segment types
 */
export type BashArgsSegment =
  | BashArgsSegmentLiteral
  | BashArgsSegmentEnum
  | BashArgsSegmentString
  | BashArgsSegmentAnything
  | BashArgsSegmentFilePath
  | BashArgsSegmentOptional
  | BashArgsSegmentRepeat;

/**
 * HTTP request constraints for curl/fetch-like tools
 * Used to restrict which URLs can be accessed and how
 */
export interface CurlOptions {
  /**
   * Function to provide default headers (e.g., authorization)
   * Useful for adding auth headers to requests to custom services
   */
  defaultHeaders?: (
    url: string,
    method: string
  ) => Awaitable<Record<string, string>>;

  /** Allowed HTTP methods */
  allowedMethods?: string[];

  /** Allowed URL patterns (can include wildcards) */
  allowedUrls?: string[];

  /** Custom validation function for requests */
  allow?: (
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string
  ) => boolean;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Maximum response size in bytes */
  maxResponseSize?: number;

  /** Follow redirects */
  followRedirects?: boolean;

  /** Maximum number of redirects to follow */
  maxRedirects?: number;
}

/**
 * System tool options - combines all tool constraint types
 * Used when creating system tools with multiple constraint types
 */
export interface SystemToolOptions {
  /** File access constraints */
  file?: FileAccessOptions;

  /** Bash execution constraints */
  bash?: BashOptions;

  /** HTTP request constraints */
  curl?: CurlOptions;
}
