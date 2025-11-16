/**
 * @aaow/core - AI Agent Orchestration Workflow Core Runtime Engine
 *
 * This package provides the core runtime engine for executing AAOW workflows.
 * It integrates with Vercel AI SDK for LLM execution and supports custom storage adapters.
 *
 * @example
 * ```typescript
 * import { createApp } from '@aaow/core';
 * import { SQLiteStorageAdapter } from '@aaow/storage-adapter-sqlite';
 * import { openai } from '@ai-sdk/openai';
 *
 * const app = createApp({
 *   storage: new SQLiteStorageAdapter({ filename: './workflows.db' }),
 *   model: openai('gpt-4-turbo'),
 *   tools: {
 *     myCustomTool: {
 *       description: 'A custom tool',
 *       inputSchema: z.object({ input: z.string() }),
 *       execute: async (input) => {
 *         return { result: `Processed: ${input.input}` };
 *       }
 *     }
 *   }
 * });
 *
 * await app.initialize();
 *
 * // Define a workflow
 * const workflow = {
 *   root: {
 *     type: 'group',
 *     label: 'Main',
 *     inputType: { type: 'string' },
 *     outputType: { type: 'string' },
 *     nodes: {
 *       llm: {
 *         type: 'llm',
 *         maxRetries: 3,
 *         systemPrompt: 'You are a helpful assistant',
 *         inputType: { type: 'string' },
 *         outputType: { type: 'string' }
 *       }
 *     },
 *     edges: [
 *       { from: 'entry', to: 'llm', description: 'Start' },
 *       { from: 'llm', to: 'exit', description: 'End' }
 *     ],
 *     entryPoint: 'entry',
 *     exitPoint: 'exit'
 *   }
 * };
 *
 * // Save workflow
 * await app.saveWorkflow('my-workflow', 'My First Workflow', workflow);
 *
 * // Execute workflow
 * const result = await app.executeWorkflow('my-workflow', 'Hello, world!');
 * console.log(result.output);
 * ```
 */

// Main app factory
export { createApp, type App, type AppOptions } from "./app";

// Workflow engine
export { WorkflowEngine, type WorkflowEngineOptions } from "./engine";

// Budget pool manager
export { BudgetPoolManager } from "./budget";

// Executors
export { executeTransform } from "./executors/transform";
export { executeLLM, executeLLMWithSchema } from "./executors/llm";
export type { LLMExecutorOptions } from "./executors/llm";

// Schemas
export * from "./schemas";

// Re-export types from @aaow/types for convenience
export type {
  Workflow,
  WorkflowNode,
  WorkflowNodeGroup,
  WorkflowNodeLLM,
  WorkflowNodeTransform,
  WorkflowNodeCallWorkflow,
  WorkflowNodeStream,
  WorkflowNodeGenerator,
  WorkflowEdge,
  WorkflowContext,
  WorkflowContextItem,
  Session,
  SessionStatus,
  StorageAdapter,
  ToolRegistry,
  ToolDefinition,
  ToolProvider,
  LLMConfig,
  LLMExecutionResult,
  ExecutionContext,
  WorkflowExecutionState,
  NodeExecutionState,
  NodeExecutionStatus,
  BudgetPool,
  BudgetPoolStatus,
  ApprovalRequest,
  ApprovalType,
  ApprovalStatus,
  StoredWorkflow,
  ToolCall,
  ToolCallLog,
} from "@aaow/types";
