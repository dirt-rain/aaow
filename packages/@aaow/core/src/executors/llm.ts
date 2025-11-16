import { generateText, generateObject, tool as createTool } from "ai";
import type {
  LLMExecutionResult,
  ToolRegistry,
  ToolCall,
  StorageAdapter,
} from "@aaow/types";
import { z } from "zod";

/**
 * LLM Executor using Vercel AI SDK
 */

export interface LLMExecutorOptions {
  /** Language model to use */
  model: any; // AI SDK's LanguageModel type

  /** System prompt */
  systemPrompt?: string;

  /** Available tools */
  tools?: ToolRegistry;

  /** Maximum number of retries */
  maxRetries?: number;

  /** Temperature (0-1) */
  temperature?: number;

  /** Max tokens to generate */
  maxTokens?: number;

  /** Storage adapter for logging */
  storage?: StorageAdapter;

  /** Session ID for logging */
  sessionId?: string;

  /** Node ID for logging */
  nodeId?: string;
}

/**
 * Execute LLM with the given prompt and tools
 */
export async function executeLLM(
  prompt: string | unknown,
  options: LLMExecutorOptions
): Promise<LLMExecutionResult> {
  const {
    model,
    systemPrompt,
    tools,
    maxRetries = 3,
    temperature = 0.7,
    maxTokens,
    storage,
    sessionId,
    nodeId,
  } = options;

  try {
    // Convert prompt to string if it's an object
    const promptText =
      typeof prompt === "string" ? prompt : JSON.stringify(prompt, null, 2);

    // Convert tools to AI SDK format
    const aiTools = tools
      ? Object.entries(tools).reduce((acc, [name, toolDef]) => {
          // Extract schema - handle both Zod schemas and plain objects
          let schema: z.ZodType<any>;
          if (
            typeof toolDef.inputSchema === "object" &&
            toolDef.inputSchema !== null &&
            "parse" in toolDef.inputSchema
          ) {
            // It's a Zod schema
            schema = toolDef.inputSchema as z.ZodType<any>;
          } else {
            // It's a plain object, wrap it in z.object()
            schema = z.object(toolDef.inputSchema as any);
          }

          acc[name] = createTool({
            description: toolDef.description,
            parameters: schema,
            execute: async (input, toolOptions) => {
              if (!toolDef.execute) {
                throw new Error(`Tool ${name} has no execute function`);
              }

              const result = await toolDef.execute(input, {
                toolCallId: toolOptions?.toolCallId || `${name}-${Date.now()}`,
                messages: toolOptions?.messages,
                abortSignal: toolOptions?.abortSignal,
              });

              // Log tool call if storage is available
              if (storage && sessionId && nodeId) {
                await storage.logToolCall({
                  id: `${sessionId}-${nodeId}-${name}-${Date.now()}`,
                  executionId: `${sessionId}-${nodeId}`,
                  toolName: name,
                  toolCallId: toolOptions?.toolCallId || `${name}-${Date.now()}`,
                  args: input as Record<string, unknown>,
                  result,
                  timestamp: new Date(),
                });
              }

              return result;
            },
          });

          return acc;
        }, {} as Record<string, any>)
      : undefined;

    // Execute with AI SDK
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: promptText,
      tools: aiTools,
      maxRetries,
      temperature,
      maxTokens,
    });

    // Extract tool calls
    const toolCalls: ToolCall[] = [];
    if (result.toolCalls) {
      for (const tc of result.toolCalls) {
        toolCalls.push({
          toolName: tc.toolName,
          toolCallId: tc.toolCallId,
          args: tc.args as Record<string, unknown>,
          result: (tc as any).result,
        });
      }
    }

    const llmResult: LLMExecutionResult = {
      success: true,
      text: result.text,
      toolCalls,
      usage: result.usage
        ? {
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens,
          }
        : undefined,
    };

    return llmResult;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute LLM with structured output
 */
export async function executeLLMWithSchema<T>(
  prompt: string | unknown,
  schema: z.ZodType<T>,
  options: LLMExecutorOptions
): Promise<{ success: boolean; data?: T; error?: string }> {
  const {
    model,
    systemPrompt,
    maxRetries = 3,
    temperature = 0.7,
    maxTokens,
  } = options;

  try {
    const promptText =
      typeof prompt === "string" ? prompt : JSON.stringify(prompt, null, 2);

    const result = await generateObject({
      model,
      system: systemPrompt,
      prompt: promptText,
      schema,
      maxRetries,
      temperature,
      maxTokens,
    });

    return {
      success: true,
      data: result.object as T,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
