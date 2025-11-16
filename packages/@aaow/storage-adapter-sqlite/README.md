# @aaow/storage-adapter-sqlite

SQLite storage adapter for aaow workflows using Prisma.

## Features

- ✅ Full StorageAdapter interface implementation
- ✅ Prisma ORM with type-safe database access
- ✅ SQLite for simple, file-based storage
- ✅ Support for all workflow storage operations:
  - Workflow definitions with JSON serialization
  - Session management with workflow snapshots
  - Execution state tracking
  - LLM execution logging
  - Budget pool management (hierarchical)
  - Tool call logging
  - Human-in-the-loop approval requests
  - Stream event storage (optional)
- ✅ Transaction support
- ✅ Query filtering, sorting, and pagination
- ✅ Comprehensive test coverage

## Installation

```bash
npm install @aaow/storage-adapter-sqlite
```

## Quick Start

```typescript
import { SQLiteStorageAdapter } from "@aaow/storage-adapter-sqlite";

// Create adapter instance
const adapter = new SQLiteStorageAdapter("file:./my-workflow.db");

// Initialize (connect to database)
await adapter.initialize();

// Use the adapter
await adapter.saveWorkflow({
  id: "workflow-1",
  name: "My Workflow",
  version: "1.0.0",
  definition: myWorkflow,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Don't forget to close when done
await adapter.close();
```

## Configuration

### Database URL

The adapter accepts a database URL in the constructor or reads from `DATABASE_URL` environment variable:

```typescript
// File-based database
const adapter = new SQLiteStorageAdapter("file:./dev.db");

// In-memory database (useful for testing)
const adapter = new SQLiteStorageAdapter("file::memory:?cache=shared");

// From environment variable
process.env.DATABASE_URL = "file:./prod.db";
const adapter = new SQLiteStorageAdapter();
```

### Prisma Setup

Before using the adapter, you need to generate Prisma client and run migrations:

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations (creates database schema)
npm run prisma:migrate
```

## API Reference

See the [StorageAdapter interface](../types/src/storage.ts) for complete API documentation.

### Core Operations

#### Workflows

```typescript
await adapter.saveWorkflow(workflow);
const workflow = await adapter.getWorkflow(id);
const workflows = await adapter.listWorkflows({ limit: 10 });
await adapter.updateWorkflow(id, { version: "2.0.0" });
await adapter.deleteWorkflow(id);
```

#### Sessions

```typescript
await adapter.createSession(session);
const session = await adapter.getSession(id);
await adapter.updateSession(id, { status: "completed" });
```

#### Execution State

```typescript
await adapter.saveExecutionState(state);
const state = await adapter.getExecutionState(sessionId);
await adapter.updateNodeState(sessionId, nodeId, nodeState);
```

#### LLM Executions

```typescript
await adapter.saveLLMExecution(sessionId, nodeId, result);
const executions = await adapter.getLLMExecutions(sessionId);
const nodeExecs = await adapter.getNodeLLMExecutions(sessionId, nodeId);
```

#### Budget Pools

```typescript
await adapter.createBudgetPool(pool);
const pool = await adapter.getBudgetPool(id);
await adapter.updateBudgetPool(id, { usedBudget: 100 });
const children = await adapter.getChildBudgetPools(parentId);
```

#### Approvals

```typescript
await adapter.createApprovalRequest(request);
const pending = await adapter.listPendingApprovals();
await adapter.approveRequest(id, "user@example.com", "Looks good!");
await adapter.rejectRequest(id, "user@example.com", "Needs revision");
```

### Query Filtering

All list methods support filtering, sorting, and pagination:

```typescript
const sessions = await adapter.listSessions({
  where: { status: "running" },
  orderBy: { field: "createdAt", direction: "desc" },
  limit: 20,
  offset: 0,
});
```

## Testing

The package includes comprehensive tests covering all adapter functionality:

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Architecture

### Database Schema

The adapter uses the following tables:

- `workflows` - Workflow definitions (JSON documents)
- `sessions` - Workflow execution instances with snapshots
- `execution_states` - Runtime execution context
- `node_execution_states` - Node-level execution tracking
- `llm_executions` - LLM call results and logs
- `budget_pools` - Hierarchical budget management
- `tool_call_logs` - Tool invocation logs
- `approval_requests` - Human-in-the-loop approvals
- `stream_events` - Stream processing events (optional)

### Data Serialization

- **Workflows**: Stored as complete JSON documents (no normalization)
- **Sessions**: Include full workflow snapshots for immutability
- **Node States**: Tracked per session with input/output serialization
- **Metadata**: JSON fields for flexible extension

See [storage requirements](../../../docs/storage-requirements.md) for detailed schema design rationale.

## Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Create and apply migrations
npm run prisma:migrate

# Open Prisma Studio (database GUI)
npm run prisma:studio

# Build the package
npm run build
```

## License

WTFPL
