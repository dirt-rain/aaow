import type { Workflow } from "./core";
import type { ExecutionContext, LLMExecutionResult, ToolCall } from "./ai";

/**
 * Workflow run status
 *
 * Note: A "Session" represents a single workflow execution (workflow run).
 * The terms are used interchangeably in the codebase.
 */
export type SessionStatus =
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "waiting_for_human_review"
  | "waiting_for_budget_approval"
  | "waiting_for_workflow_approval";

/**
 * Budget pool status
 */
export type BudgetPoolStatus = "active" | "exhausted" | "suspended";

/**
 * Approval request type
 */
export type ApprovalType =
  | "human_review"
  | "budget_increase"
  | "workflow_call";

/**
 * Approval status
 */
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

/**
 * Approval request for human-in-the-loop workflows
 *
 * Tracks requests for human review, budget approval, or workflow call approval
 */
export interface ApprovalRequest {
  /** Unique approval request identifier */
  id: string;

  /** Session this approval belongs to */
  sessionId: string;

  /** Node that triggered the approval request */
  nodeId: string;

  /** Type of approval requested */
  type: ApprovalType;

  /** Current approval status */
  status: ApprovalStatus;

  /** Request context and details */
  context: {
    /** Description of what needs approval */
    description?: string;

    /** For budget approval: requested budget amount */
    requestedBudget?: number;

    /** For budget approval: current budget usage */
    currentUsage?: number;

    /** For workflow call: workflow to be called */
    workflowRef?: string;

    /** For human review: LLM output to review */
    llmOutput?: unknown;

    /** Additional context data */
    metadata?: Record<string, unknown>;
  };

  /** Request creation timestamp */
  createdAt: Date;

  /** Approval/rejection timestamp */
  resolvedAt?: Date;

  /** User who approved/rejected */
  resolvedBy?: string;

  /** Rejection reason or approval notes */
  resolutionNotes?: string;
}

/**
 * Session (Workflow Run)
 *
 * Represents a single execution instance of a workflow.
 * "Session" and "Workflow Run" are used interchangeably.
 */
export interface Session {
  /** Unique session identifier (also the workflow run ID) */
  id: string;

  /** Reference to workflow definition being executed */
  workflowId: string;

  /** Current execution status */
  status: SessionStatus;

  /** Session creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** Additional metadata (user info, tags, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Budget pool for hierarchical cost control
 */
export interface BudgetPool {
  /** Unique budget pool identifier */
  id: string;

  /** Parent pool ID for hierarchical budgets */
  parentPoolId?: string;

  /** Total allocated budget (tokens or cost) */
  totalBudget: number;

  /** Budget already consumed */
  usedBudget: number;

  /** Remaining budget */
  remainingBudget: number;

  /** Pool status */
  status: BudgetPoolStatus;

  /** Pool creation timestamp */
  createdAt: Date;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Node execution status
 */
export type NodeExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "waiting_for_approval"
  | "waiting_for_review";

/**
 * Node execution state within a workflow run
 */
export interface NodeExecutionState {
  /** Node identifier */
  nodeId: string;

  /** Execution status */
  status: NodeExecutionStatus;

  /** Node input data */
  input?: unknown;

  /** Node output data */
  output?: unknown;

  /** Error message if failed */
  error?: string;

  /** Execution start timestamp */
  startedAt?: Date;

  /** Execution completion timestamp */
  completedAt?: Date;

  /** Retry count */
  retryCount?: number;

  /** Pending approval request ID (if waiting for approval/review) */
  pendingApprovalId?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Extended execution context with runtime state
 */
export interface WorkflowExecutionState extends ExecutionContext {
  /** Current node being executed */
  currentNodeId?: string;

  /** Execution completion timestamp */
  completedAt?: Date;

  /** Execution status */
  status: SessionStatus;

  /** Node execution states */
  nodeStates: Record<string, NodeExecutionState>;
}

/**
 * Tool call log entry
 */
export interface ToolCallLog extends ToolCall {
  /** Unique tool call log identifier */
  id: string;

  /** Reference to LLM execution */
  executionId: string;

  /** Call timestamp */
  timestamp: Date;

  /** Execution duration in milliseconds */
  duration?: number;
}

/**
 * Stream event for reactive data processing
 */
export interface StreamEvent {
  /** Unique stream event identifier */
  id: string;

  /** Stream identifier */
  streamId: string;

  /** Reference to stream node */
  nodeId: string;

  /** Event data */
  data: unknown;

  /** Event timestamp */
  timestamp: Date;
}

/**
 * Stored workflow with metadata
 */
export interface StoredWorkflow {
  /** Unique workflow identifier */
  id: string;

  /** Workflow name */
  name: string;

  /** Workflow version */
  version: string;

  /** Workflow definition */
  definition: Workflow;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Query filter options
 */
export interface QueryFilter<T> {
  /** Field-based filters */
  where?: Partial<T>;

  /** Sort options */
  orderBy?: {
    field: keyof T;
    direction: "asc" | "desc";
  };

  /** Limit results */
  limit?: number;

  /** Skip results (pagination) */
  offset?: number;
}

/**
 * Transaction context for atomic operations
 */
export interface Transaction {
  /** Commit the transaction */
  commit(): Promise<void>;

  /** Rollback the transaction */
  rollback(): Promise<void>;
}

/**
 * Storage adapter interface for persisting workflow data
 *
 * Implementations should provide ACID guarantees for critical operations
 * and support async I/O for scalability.
 */
export interface StorageAdapter {
  /**
   * Initialize the storage adapter (connect, migrate schema, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Close the storage adapter and cleanup resources
   */
  close(): Promise<void>;

  /**
   * Begin a new transaction for atomic operations
   */
  beginTransaction(): Promise<Transaction>;

  // ==================== Workflow Operations ====================

  /**
   * Store a workflow definition
   */
  saveWorkflow(workflow: StoredWorkflow): Promise<void>;

  /**
   * Retrieve a workflow by ID
   */
  getWorkflow(id: string): Promise<StoredWorkflow | null>;

  /**
   * List workflows with optional filtering
   */
  listWorkflows(filter?: QueryFilter<StoredWorkflow>): Promise<StoredWorkflow[]>;

  /**
   * Update a workflow definition
   */
  updateWorkflow(id: string, workflow: Partial<StoredWorkflow>): Promise<void>;

  /**
   * Delete a workflow
   */
  deleteWorkflow(id: string): Promise<void>;

  // ==================== Session Operations ====================

  /**
   * Create a new session
   */
  createSession(session: Session): Promise<void>;

  /**
   * Get a session by ID
   */
  getSession(id: string): Promise<Session | null>;

  /**
   * List sessions with optional filtering
   */
  listSessions(filter?: QueryFilter<Session>): Promise<Session[]>;

  /**
   * Update session status and metadata
   */
  updateSession(id: string, session: Partial<Session>): Promise<void>;

  /**
   * Delete a session and associated data
   */
  deleteSession(id: string): Promise<void>;

  // ==================== Execution State Operations ====================

  /**
   * Save workflow execution state
   */
  saveExecutionState(state: WorkflowExecutionState): Promise<void>;

  /**
   * Get execution state by session ID
   */
  getExecutionState(sessionId: string): Promise<WorkflowExecutionState | null>;

  /**
   * Update node execution state
   */
  updateNodeState(
    sessionId: string,
    nodeId: string,
    state: NodeExecutionState
  ): Promise<void>;

  // ==================== LLM Execution Operations ====================

  /**
   * Store LLM execution result
   */
  saveLLMExecution(
    sessionId: string,
    nodeId: string,
    result: LLMExecutionResult & { id: string; timestamp: Date }
  ): Promise<void>;

  /**
   * Get LLM executions for a session
   */
  getLLMExecutions(
    sessionId: string,
    filter?: QueryFilter<LLMExecutionResult & { id: string; timestamp: Date }>
  ): Promise<(LLMExecutionResult & { id: string; timestamp: Date })[]>;

  /**
   * Get LLM executions for a specific node
   */
  getNodeLLMExecutions(
    sessionId: string,
    nodeId: string
  ): Promise<(LLMExecutionResult & { id: string; timestamp: Date })[]>;

  // ==================== Budget Pool Operations ====================

  /**
   * Create a budget pool
   */
  createBudgetPool(pool: BudgetPool): Promise<void>;

  /**
   * Get a budget pool by ID
   */
  getBudgetPool(id: string): Promise<BudgetPool | null>;

  /**
   * Update budget pool usage
   */
  updateBudgetPool(id: string, pool: Partial<BudgetPool>): Promise<void>;

  /**
   * Get child budget pools
   */
  getChildBudgetPools(parentId: string): Promise<BudgetPool[]>;

  // ==================== Tool Call Operations ====================

  /**
   * Log a tool call
   */
  logToolCall(log: ToolCallLog): Promise<void>;

  /**
   * Get tool calls for an execution
   */
  getToolCalls(executionId: string): Promise<ToolCallLog[]>;

  /**
   * Get tool calls for a session
   */
  getSessionToolCalls(
    sessionId: string,
    filter?: QueryFilter<ToolCallLog>
  ): Promise<ToolCallLog[]>;

  // ==================== Approval Operations ====================

  /**
   * Create an approval request
   */
  createApprovalRequest(request: ApprovalRequest): Promise<void>;

  /**
   * Get an approval request by ID
   */
  getApprovalRequest(id: string): Promise<ApprovalRequest | null>;

  /**
   * List approval requests for a session
   */
  listApprovalRequests(
    sessionId: string,
    filter?: QueryFilter<ApprovalRequest>
  ): Promise<ApprovalRequest[]>;

  /**
   * List pending approval requests across all sessions
   */
  listPendingApprovals(
    filter?: QueryFilter<ApprovalRequest>
  ): Promise<ApprovalRequest[]>;

  /**
   * Update approval request status (approve/reject)
   */
  updateApprovalRequest(
    id: string,
    update: Partial<ApprovalRequest>
  ): Promise<void>;

  /**
   * Approve an approval request
   */
  approveRequest(
    id: string,
    approvedBy: string,
    notes?: string
  ): Promise<void>;

  /**
   * Reject an approval request
   */
  rejectRequest(id: string, rejectedBy: string, reason?: string): Promise<void>;

  // ==================== Stream Operations (Optional) ====================

  /**
   * Store a stream event
   */
  saveStreamEvent?(event: StreamEvent): Promise<void>;

  /**
   * Get stream events
   */
  getStreamEvents?(
    streamId: string,
    filter?: QueryFilter<StreamEvent>
  ): Promise<StreamEvent[]>;
}

/**
 * Storage adapter factory for dependency injection
 */
export interface StorageAdapterFactory {
  /**
   * Create a new storage adapter instance
   */
  createAdapter(): StorageAdapter | Promise<StorageAdapter>;
}
