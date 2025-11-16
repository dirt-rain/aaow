# @aaow/core

Core runtime engine for AAOW (AI Agent Orchestration Workflow).

## Features

- 🚀 **Workflow Execution Engine** - Execute complex AI agent workflows
- 🤖 **Vercel AI SDK Integration** - Built-in support for LLM execution
- 📊 **Budget Pool Management** - Hierarchical cost tracking and control
- 🔧 **Custom Tools** - Extensible tool system for LLM agents
- 💾 **Storage Adapters** - Pluggable persistence layer
- ✅ **Zod Validation** - Type-safe workflow validation
- 👥 **Human-in-the-Loop** - Approval workflows for critical operations

## Installation

```bash
npm install @aaow/core @aaow/storage-adapter-sqlite
```

## Quick Start

```typescript
import { createApp } from '@aaow/core';
import { SQLiteStorageAdapter } from '@aaow/storage-adapter-sqlite';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Create app with storage adapter and model
const app = createApp({
  storage: new SQLiteStorageAdapter({
    filename: './workflows.db'
  }),
  model: openai('gpt-4-turbo'),
  tools: {
    // Custom tools
    searchWeb: {
      description: 'Search the web for information',
      inputSchema: z.object({
        query: z.string().describe('Search query')
      }),
      execute: async ({ query }) => {
        // Implementation
        return { results: [] };
      }
    }
  }
});

// Initialize
await app.initialize();

// Define a workflow
const workflow = {
  root: {
    type: 'group',
    label: 'Main Workflow',
    inputType: { type: 'string' },
    outputType: { type: 'string' },
    nodes: {
      llm: {
        type: 'llm',
        maxRetries: 3,
        systemPrompt: 'You are a helpful assistant',
        inputType: { type: 'string' },
        outputType: { type: 'string' },
        availableTools: [
          { type: 'custom', name: 'searchWeb' }
        ]
      }
    },
    edges: [
      { from: 'entry', to: 'llm', description: 'Start' },
      { from: 'llm', to: 'exit', description: 'End' }
    ],
    entryPoint: 'entry',
    exitPoint: 'exit'
  }
};

// Save workflow
await app.saveWorkflow(
  'assistant-workflow',
  'AI Assistant',
  workflow
);

// Execute workflow
const result = await app.executeWorkflow(
  'assistant-workflow',
  'What is the capital of France?'
);

console.log(result.output); // "The capital of France is Paris."

// Cleanup
await app.close();
```

## Workflow Node Types

### Group Node

Hierarchical grouping of nodes with entry/exit points:

```typescript
{
  type: 'group',
  label: 'Processing Group',
  nodes: { /* ... */ },
  edges: [ /* ... */ ],
  entryPoint: 'start',
  exitPoint: 'end'
}
```

### LLM Node

Execute LLM with tools and human review:

```typescript
{
  type: 'llm',
  maxRetries: 3,
  systemPrompt: 'You are an expert analyst',
  availableTools: [
    { type: 'custom', name: 'analyzeData' }
  ],
  requiresHumanReview: true
}
```

### Transform Node

Data transformation functions:

```typescript
{
  type: 'transform',
  fn: {
    type: 'object',
    value: {
      summary: { type: 'get', path: ['text'] },
      wordCount: { type: 'const', value: 100 }
    }
  }
}
```

### Call Workflow Node

Execute another workflow as a subroutine:

```typescript
{
  type: 'callWorkflow',
  workflowRef: 'sub-workflow-id',
  requiresApproval: true,
  inputMapping: { /* ... */ },
  outputMapping: { /* ... */ }
}
```

## Budget Pool Management

```typescript
// Create budget pool
const poolId = 'project-budget';
await app.budgetManager.createPool(poolId, 1000000); // 1M tokens

// Execute with budget
const result = await app.executeWorkflow(
  'workflow-id',
  input,
  { budgetPoolId: poolId }
);

// Check remaining budget
const pool = await app.budgetManager.getPool(poolId);
console.log(`Remaining: ${pool.remainingBudget} tokens`);
```

## Human-in-the-Loop Approvals

```typescript
// Workflow with approval required
const workflow = {
  root: {
    type: 'group',
    nodes: {
      sensitiveAction: {
        type: 'llm',
        requiresHumanReview: true,
        // ...
      }
    }
    // ...
  }
};

// Execution will pause and create approval request
try {
  await app.executeWorkflow('workflow-id', input);
} catch (error) {
  // Check for pending approvals
  const approvals = await app.storage.listPendingApprovals();

  // Approve the request
  await app.approveRequest(
    approvals[0].id,
    'user@example.com',
    'Looks good!'
  );
}
```

## Custom Storage Adapters

Implement the `StorageAdapter` interface:

```typescript
import type { StorageAdapter } from '@aaow/types';

class MyStorageAdapter implements StorageAdapter {
  async initialize() { /* ... */ }
  async close() { /* ... */ }
  async saveWorkflow(workflow) { /* ... */ }
  // ... implement all required methods
}

const app = createApp({
  storage: new MyStorageAdapter(),
  // ...
});
```

## API Reference

### createApp(options)

Creates an AAOW application instance.

**Options:**
- `storage: StorageAdapter` - Storage adapter for persistence (required)
- `model?: LanguageModel` - Language model from AI SDK (optional)
- `tools?: ToolRegistry` - Custom tools registry (optional)
- `validateWorkflows?: boolean` - Enable workflow validation (default: true)

**Returns:** `App`

### App Methods

- `initialize(): Promise<void>` - Initialize storage and resources
- `close(): Promise<void>` - Cleanup and close connections
- `saveWorkflow(id, name, workflow, options?): Promise<void>` - Save a workflow
- `getWorkflow(id): Promise<Workflow | null>` - Get a workflow by ID
- `executeWorkflow(workflowId, input, options?): Promise<Result>` - Execute a workflow
- `approveRequest(approvalId, approvedBy, notes?): Promise<void>` - Approve a request
- `rejectRequest(approvalId, rejectedBy, reason?): Promise<void>` - Reject a request

## License

WTFPL
