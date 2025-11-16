# Storage Requirements

## Overview

The `aaow` storage adapter provides an interface for persisting runtime data including workflow executions, session management, budget tracking, LLM execution logs, and human-in-the-loop approval requests.

## Terminology

- **Session** = **Workflow Run**: These terms are used interchangeably. A session represents a single execution instance of a workflow.
- **Node**: A unit of work within a workflow (LLM, Transform, Stream, etc.)
- **Budget Pool**: Hierarchical cost control mechanism for tracking token/dollar usage

## Data to Store

### 1. Workflow Definitions

Store the structural definition of workflows.

**Entities:**
- **Workflow**: Complete workflow definition (node graph, edges, type definitions)
- **WorkflowNode**: Individual node definitions (LLM, Transform, Stream, Generator, etc.)
- **WorkflowEdge**: Connections between nodes
- **WorkflowContext**: Workflow context data

**Purpose:**
- Workflow reuse and version management
- Loading workflows at runtime
- External workflow references from CallWorkflow nodes

**Key Fields:**
- `id`: Unique workflow identifier
- `name`: Human-readable workflow name
- `version`: Semantic version string
- `definition`: Complete workflow graph structure
- `createdAt`, `updatedAt`: Timestamps
- `metadata`: Additional data (tags, author, description, etc.)

---

### 2. Sessions (Workflow Runs)

Track workflow execution instances.

**Purpose:**
- Track multiple concurrent workflow executions
- Isolate execution contexts per session
- Resume interrupted workflows
- Monitor execution status

**Key Fields:**
- `id`: Unique session identifier (workflow run ID)
- `workflowId`: Reference to workflow definition
- `status`: Execution status (see below)
- `createdAt`, `updatedAt`: Timestamps
- `metadata`: User info, tags, execution parameters

**Session Status Values:**
- `running`: Workflow actively executing
- `paused`: Execution temporarily paused
- `completed`: Successfully finished
- `failed`: Terminated with error
- `waiting_for_human_review`: Paused for human review (WorkflowNodeLLM.requiresHumanReview)
- `waiting_for_budget_approval`: Paused for budget increase approval
- `waiting_for_workflow_approval`: Paused for workflow call approval (WorkflowNodeCallWorkflow.requiresApproval)

---

### 3. Execution Context and State

Store runtime context for individual workflow executions.

**Purpose:**
- Resume workflow execution from checkpoints
- Monitor execution progress in real-time
- Debug and trace execution flow
- Track node-level execution states

**Key Fields:**
- `sessionId`: Reference to session
- `budgetPoolId`: Reference to budget pool
- `startedAt`, `completedAt`: Execution timeline
- `currentNodeId`: Currently executing node
- `status`: Overall execution status
- `nodeStates`: Map of node ID to execution state
- `metadata`: Execution-specific data

**Node Execution State:**
- `nodeId`: Node identifier
- `status`: Node execution status (see below)
- `input`, `output`: Node input/output data
- `error`: Error message if failed
- `startedAt`, `completedAt`: Node execution timeline
- `retryCount`: Number of retry attempts
- `pendingApprovalId`: Reference to approval request (if waiting)
- `metadata`: Node-specific data

**Node Execution Status Values:**
- `pending`: Not yet started
- `running`: Currently executing
- `completed`: Successfully finished
- `failed`: Terminated with error
- `skipped`: Skipped due to conditional branching
- `waiting_for_approval`: Waiting for workflow call approval
- `waiting_for_review`: Waiting for human review

---

### 4. LLM Execution Results

Store LLM node execution results and logs.

**Purpose:**
- Audit and log all LLM calls
- Cost tracking and analysis
- Debug LLM behavior
- Support retry logic
- Performance optimization

**Key Fields:**
- `id`: Execution identifier
- `sessionId`: Reference to session
- `nodeId`: Reference to LLM node
- `timestamp`: Execution time
- `success`: Whether execution succeeded
- `text`: Generated text output
- `toolCalls`: List of tool calls made
- `usage`: Token usage statistics
  - `promptTokens`: Input tokens
  - `completionTokens`: Output tokens
  - `totalTokens`: Total tokens
- `error`: Error message if failed
- `metadata`: Model, temperature, etc.

---

### 5. Budget Pools

Track hierarchical budget pools for cost control.

**Purpose:**
- Cost control and tracking
- Hierarchical budget management (parent/child pools)
- Prevent budget overruns
- Human-in-the-loop budget approval workflows

**Key Fields:**
- `id`: Budget pool identifier
- `parentPoolId`: Parent pool (for hierarchical budgets)
- `totalBudget`: Total allocated budget (tokens or dollars)
- `usedBudget`: Budget consumed
- `remainingBudget`: Budget remaining
- `status`: Pool status
  - `active`: Normal operation
  - `exhausted`: Budget fully consumed
  - `suspended`: Manually suspended
- `createdAt`: Creation timestamp
- `metadata`: Additional information

**Hierarchical Budget Flow:**
1. Workflow executes within caller's budget pool
2. When budget exhausted, LLM node can request budget increase via tool call
3. Creates approval request (human-in-the-loop)
4. Upon approval, new child budget pool created
5. Execution continues in new pool

---

### 6. Tool Call Logs

Store detailed logs of tool calls made by LLM nodes.

**Purpose:**
- Track tool usage patterns
- Debug tool execution
- Performance analysis
- Audit logging

**Key Fields:**
- `id`: Tool call log identifier
- `executionId`: Reference to LLM execution
- `toolCallId`: Tool call identifier
- `toolName`: Name of tool invoked
- `args`: Arguments passed to tool
- `result`: Tool execution result
- `error`: Error if tool failed
- `timestamp`: Call timestamp
- `duration`: Execution duration (ms)

---

### 7. Approval Requests (Human-in-the-Loop)

Track approval requests for human intervention.

**Purpose:**
- Human-in-the-loop workflows
- Budget approval workflow
- Workflow call approval
- LLM output review
- Audit trail of approvals

**Key Fields:**
- `id`: Approval request identifier
- `sessionId`: Reference to session
- `nodeId`: Node that triggered request
- `type`: Approval type
  - `human_review`: LLM output needs human review
  - `budget_increase`: Budget increase request
  - `workflow_call`: Workflow call needs approval
- `status`: Approval status
  - `pending`: Awaiting decision
  - `approved`: Approved by user
  - `rejected`: Rejected by user
  - `expired`: Timed out
- `context`: Request-specific data
  - `description`: What needs approval
  - `requestedBudget`: For budget requests
  - `currentUsage`: For budget requests
  - `workflowRef`: For workflow call approval
  - `llmOutput`: For human review
  - `metadata`: Additional context
- `createdAt`: Request timestamp
- `resolvedAt`: Approval/rejection timestamp
- `resolvedBy`: User who approved/rejected
- `resolutionNotes`: Approval notes or rejection reason

**Approval Flow:**
1. Node requires approval (requiresHumanReview, requiresApproval, budget exhausted)
2. Create ApprovalRequest with status `pending`
3. Update Session status to appropriate `waiting_for_*` status
4. Update NodeExecutionState status to `waiting_for_approval` or `waiting_for_review`
5. Store `pendingApprovalId` in NodeExecutionState
6. Wait for user action (approve/reject)
7. Update ApprovalRequest status and resolution fields
8. Resume workflow execution or fail gracefully

---

### 8. Stream Events (Optional)

Store stream node event logs.

**Purpose:**
- Track reactive data processing
- Debug stream operations
- Event replay for testing
- Real-time monitoring

**Key Fields:**
- `id`: Stream event identifier
- `streamId`: Stream identifier
- `nodeId`: Reference to stream node
- `data`: Event data
- `timestamp`: Event timestamp

---

## Storage Adapter Requirements

### SQLite Implementation (Initial Target)

SQLite provides the following benefits:

- **Simple Setup**: No separate server required
- **Local Development**: Fast local dev and testing
- **Transaction Support**: ACID guarantees
- **Performance**: Sufficient for single-user/server scenarios
- **File-based**: Easy backup and portability

### Adapter Interface Requirements

1. **CRUD Operations**: Create, Read, Update, Delete support
2. **Transactions**: Atomic operation guarantees
3. **Queries**: Filtering, sorting, pagination
4. **Relationships**: Foreign keys and joins
5. **Migrations**: Schema version management
6. **Async I/O**: Non-blocking operations

### Extensibility Considerations

Design for future storage backend expansion:

- **PostgreSQL** (production environments)
- **MongoDB** (document-oriented storage)
- **Redis** (caching layer)
- **S3/Object Storage** (large-scale data)

---

## Schema Design Considerations

### Normalization

- Minimize data duplication
- Maintain referential integrity
- Optimize query performance

### Indexing

Add indexes on common query paths:
- Session ID for execution lookups
- Workflow ID for definition lookups
- Timestamp range queries
- Approval status for pending approval queries
- Budget pool hierarchy traversal

### JSON Fields

Use JSON columns for flexible metadata:
- `ExecutionContext.metadata`
- `LLMExecutionResult.metadata`
- `BudgetPool.metadata`
- `ApprovalRequest.context`

### Foreign Key Relationships

```
Workflow (1) -> (N) Session
Session (1) -> (1) WorkflowExecutionState
Session (1) -> (N) NodeExecutionState
Session (1) -> (N) LLMExecutionResult
Session (1) -> (N) ApprovalRequest
LLMExecutionResult (1) -> (N) ToolCallLog
BudgetPool (1) -> (N) BudgetPool (parent-child hierarchy)
ApprovalRequest (1) -> (1) NodeExecutionState
```

---

## Data Retention Policy

- **Development**: Unlimited retention
- **Production**: Configurable retention periods
- **Auto-cleanup**: Archive/delete old logs
- **Critical Data**: Never auto-delete workflow definitions, approvals

---

## Security Considerations

- **Sensitive Data**: Encrypt API keys, user credentials
- **Access Control**: Session isolation, user-based access
- **Audit Logging**: Track all state changes
- **Approval Integrity**: Cryptographic signatures for approvals (future)

---

## Implementation Checklist

### Phase 1: Core Storage (SQLite)
- [ ] Workflow CRUD operations
- [ ] Session management
- [ ] Execution state tracking
- [ ] Node execution states

### Phase 2: LLM & Budget Tracking
- [ ] LLM execution logging
- [ ] Token usage tracking
- [ ] Budget pool management
- [ ] Hierarchical budget pools

### Phase 3: Human-in-the-Loop
- [ ] Approval request CRUD
- [ ] Approval workflow
- [ ] Session pause/resume
- [ ] Timeout handling for approvals

### Phase 4: Advanced Features
- [ ] Tool call logging
- [ ] Stream event storage
- [ ] Query optimization
- [ ] Migration system

### Phase 5: Production Readiness
- [ ] Data retention policies
- [ ] Backup/restore
- [ ] Performance benchmarking
- [ ] PostgreSQL adapter

---

## Example Queries

### Get pending approvals for a user
```sql
SELECT * FROM approval_requests
WHERE status = 'pending'
ORDER BY createdAt ASC
```

### Get session execution history
```sql
SELECT s.*, w.name as workflow_name
FROM sessions s
JOIN workflows w ON s.workflowId = w.id
WHERE s.createdAt >= ?
ORDER BY s.createdAt DESC
```

### Calculate budget usage by workflow
```sql
SELECT w.name, SUM(bp.usedBudget) as total_usage
FROM budget_pools bp
JOIN sessions s ON bp.id = s.budgetPoolId
JOIN workflows w ON s.workflowId = w.id
GROUP BY w.id, w.name
ORDER BY total_usage DESC
```

### Get LLM execution statistics
```sql
SELECT
  nodeId,
  COUNT(*) as execution_count,
  SUM(usage_totalTokens) as total_tokens,
  AVG(usage_totalTokens) as avg_tokens,
  SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count
FROM llm_executions
WHERE sessionId = ?
GROUP BY nodeId
```
