import type { StorageAdapter, ToolRegistry, Workflow } from "@aaow/types";
import { WorkflowEngine } from "./engine";
import { BudgetPoolManager } from "./budget";
import { WorkflowSchema } from "./schemas";

/**
 * Application options for createApp
 */
export interface AppOptions {
  /** Storage adapter for persistence */
  storage: StorageAdapter;

  /** Tool registry for custom tools */
  tools?: ToolRegistry;

  /** Language model for LLM nodes (from AI SDK) */
  model?: any;

  /** Whether to validate workflows with zod schemas */
  validateWorkflows?: boolean;
}

/**
 * Application instance
 */
export interface App {
  /** Storage adapter */
  storage: StorageAdapter;

  /** Budget pool manager */
  budgetManager: BudgetPoolManager;

  /** Execute a workflow */
  executeWorkflow(
    workflowId: string,
    input: unknown,
    options?: {
      sessionId?: string;
      budgetPoolId?: string;
    }
  ): Promise<{ sessionId: string; output: unknown; success: boolean }>;

  /** Save a workflow */
  saveWorkflow(
    id: string,
    name: string,
    workflow: Workflow,
    options?: {
      version?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void>;

  /** Get a workflow */
  getWorkflow(id: string): Promise<Workflow | null>;

  /** Approve an approval request */
  approveRequest(
    approvalId: string,
    approvedBy: string,
    notes?: string
  ): Promise<void>;

  /** Reject an approval request */
  rejectRequest(
    approvalId: string,
    rejectedBy: string,
    reason?: string
  ): Promise<void>;

  /** Initialize the app (connect to storage, etc.) */
  initialize(): Promise<void>;

  /** Close the app and cleanup resources */
  close(): Promise<void>;
}

/**
 * Create an AAOW application instance
 *
 * @example
 * ```typescript
 * import { createApp } from '@aaow/core';
 * import { SQLiteStorageAdapter } from '@aaow/storage-adapter-sqlite';
 * import { openai } from '@ai-sdk/openai';
 *
 * const app = createApp({
 *   storage: new SQLiteStorageAdapter({ filename: './data.db' }),
 *   model: openai('gpt-4'),
 *   tools: {
 *     // Custom tools here
 *   }
 * });
 *
 * await app.initialize();
 *
 * // Save a workflow
 * await app.saveWorkflow('my-workflow', 'My Workflow', workflowDefinition);
 *
 * // Execute the workflow
 * const result = await app.executeWorkflow('my-workflow', { input: 'data' });
 *
 * console.log(result.output);
 * ```
 */
export function createApp(options: AppOptions): App {
  const { storage, tools, model, validateWorkflows = true } = options;

  const budgetManager = new BudgetPoolManager(storage);

  return {
    storage,
    budgetManager,

    async initialize() {
      await storage.initialize();
    },

    async close() {
      await storage.close();
    },

    async saveWorkflow(id, name, workflow, options = {}) {
      // Validate workflow if enabled
      if (validateWorkflows) {
        const result = WorkflowSchema.safeParse(workflow);
        if (!result.success) {
          throw new Error(
            `Invalid workflow: ${JSON.stringify(result.error.errors, null, 2)}`
          );
        }
      }

      await storage.saveWorkflow({
        id,
        name,
        version: options.version || "1.0.0",
        definition: workflow,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: options.metadata,
      });
    },

    async getWorkflow(id) {
      const stored = await storage.getWorkflow(id);
      return stored ? stored.definition : null;
    },

    async executeWorkflow(workflowId, input, options = {}) {
      // Get workflow
      const storedWorkflow = await storage.getWorkflow(workflowId);
      if (!storedWorkflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      // Create engine
      const engine = new WorkflowEngine({
        storage,
        tools,
        model,
        budgetPoolId: options.budgetPoolId,
      });

      // Execute
      return engine.executeWorkflow(
        storedWorkflow.definition,
        workflowId,
        input,
        options
      );
    },

    async approveRequest(approvalId, approvedBy, notes) {
      await storage.approveRequest(approvalId, approvedBy, notes);
    },

    async rejectRequest(approvalId, rejectedBy, reason) {
      await storage.rejectRequest(approvalId, rejectedBy, reason);
    },
  };
}
