import type { CoreTool } from "ai";
import type { z } from "zod";

/**
 * Tool definition compatible with Vercel AI SDK
 * This is a re-export of CoreTool for convenience and consistency
 */
export type ToolDefinition<TParameters extends z.ZodType = z.ZodType> =
  CoreTool<TParameters>;

/**
 * Tool registry - manages tools by name
 * Allows external tools to be injected into the workflow
 */
export type ToolRegistry = Record<string, ToolDefinition>;

/**
 * Tool provider interface for dependency injection
 * Implementations can provide custom tools to the workflow
 */
export interface ToolProvider {
  /**
   * Returns a registry of tools that can be used by LLM agents
   */
  getTools(): ToolRegistry | Promise<ToolRegistry>;
}

/**
 * LLM configuration for workflow nodes
 */
export interface LLMConfig {
  /** Model identifier (e.g., "gpt-4", "claude-3-opus-20240229") */
  model: string;

  /** System prompt for the LLM */
  systemPrompt?: string;

  /** Tools available to the LLM */
  tools?: ToolRegistry;

  /** Maximum number of tokens to generate */
  maxTokens?: number;

  /** Temperature for sampling (0-1) */
  temperature?: number;

  /** Top-p sampling parameter */
  topP?: number;

  /** Maximum number of retries on failure */
  maxRetries?: number;
}

/**
 * Execution context for workflow runs
 */
export interface ExecutionContext {
  /** Unique session identifier */
  sessionId: string;

  /** Budget pool identifier for cost tracking */
  budgetPoolId?: string;

  /** Additional metadata for the execution */
  metadata?: Record<string, unknown>;

  /** Timestamp when the execution started */
  startedAt?: Date;
}

/**
 * Result of an LLM execution
 */
export interface LLMExecutionResult {
  /** Whether the execution completed successfully */
  success: boolean;

  /** Generated text output */
  text?: string;

  /** Tool calls made during execution */
  toolCalls?: ToolCall[];

  /** Error message if execution failed */
  error?: string;

  /** Token usage statistics */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  /** Execution metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Represents a tool call made by the LLM
 */
export interface ToolCall {
  /** Tool identifier */
  toolName: string;

  /** Tool call identifier */
  toolCallId: string;

  /** Arguments passed to the tool */
  args: Record<string, unknown>;

  /** Result of the tool execution */
  result?: unknown;

  /** Error if tool execution failed */
  error?: string;
}

/**
 * Streaming execution result
 */
export interface StreamingLLMResult {
  /** Text stream as it's being generated */
  textStream: AsyncIterable<string>;

  /** Full result promise */
  result: Promise<LLMExecutionResult>;

  /** Abort the execution */
  abort?: () => Promise<void>;
}
