import { PrismaClient } from "@prisma/client";
import type {
  StorageAdapter,
  Transaction,
  StoredWorkflow,
  Session,
  WorkflowExecutionState,
  NodeExecutionState,
  LLMExecutionResult,
  BudgetPool,
  ToolCallLog,
  ApprovalRequest,
  StreamEvent,
  QueryFilter,
} from "@aaow/types";
import type { Workflow } from "@aaow/types";

/**
 * SQLite storage adapter using Prisma
 */
export class SQLiteStorageAdapter implements StorageAdapter {
  private prisma: PrismaClient;
  private initialized = false;

  constructor(databaseUrl?: string) {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl || process.env.DATABASE_URL || "file:./dev.db",
        },
      },
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.prisma.$connect();
    this.initialized = true;
  }

  async close(): Promise<void> {
    if (!this.initialized) return;

    await this.prisma.$disconnect();
    this.initialized = false;
  }

  async beginTransaction(): Promise<Transaction> {
    // Prisma doesn't expose interactive transactions in a standard Transaction interface
    // We'll use Prisma's interactive transactions internally
    // For this implementation, we'll return a transaction wrapper
    let tx: any;
    const transactionPromise = this.prisma.$transaction(async (prisma) => {
      tx = prisma;
      // Return a promise that will be resolved when commit is called
      return new Promise((resolve, reject) => {
        (tx as any)._resolve = resolve;
        (tx as any)._reject = reject;
      });
    });

    return {
      commit: async () => {
        if (tx?._resolve) tx._resolve();
        await transactionPromise;
      },
      rollback: async () => {
        if (tx?._reject) tx._reject(new Error("Transaction rolled back"));
        try {
          await transactionPromise;
        } catch {
          // Expected to throw
        }
      },
    };
  }

  // ==================== Workflow Operations ====================

  async saveWorkflow(workflow: StoredWorkflow): Promise<void> {
    await this.prisma.workflow.create({
      data: {
        id: workflow.id,
        name: workflow.name,
        version: workflow.version,
        definition: JSON.stringify(workflow.definition),
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        metadata: workflow.metadata ? JSON.stringify(workflow.metadata) : null,
      },
    });
  }

  async getWorkflow(id: string): Promise<StoredWorkflow | null> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
    });

    if (!workflow) return null;

    return {
      id: workflow.id,
      name: workflow.name,
      version: workflow.version,
      definition: JSON.parse(workflow.definition) as Workflow,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      metadata: workflow.metadata ? JSON.parse(workflow.metadata) : undefined,
    };
  }

  async listWorkflows(
    filter?: QueryFilter<StoredWorkflow>
  ): Promise<StoredWorkflow[]> {
    const workflows = await this.prisma.workflow.findMany({
      where: this.buildWhereClause(filter?.where),
      orderBy: filter?.orderBy
        ? { [filter.orderBy.field as string]: filter.orderBy.direction }
        : undefined,
      take: filter?.limit,
      skip: filter?.offset,
    });

    return workflows.map((w) => ({
      id: w.id,
      name: w.name,
      version: w.version,
      definition: JSON.parse(w.definition) as Workflow,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      metadata: w.metadata ? JSON.parse(w.metadata) : undefined,
    }));
  }

  async updateWorkflow(
    id: string,
    workflow: Partial<StoredWorkflow>
  ): Promise<void> {
    const data: any = {};

    if (workflow.name !== undefined) data.name = workflow.name;
    if (workflow.version !== undefined) data.version = workflow.version;
    if (workflow.definition !== undefined)
      data.definition = JSON.stringify(workflow.definition);
    if (workflow.metadata !== undefined)
      data.metadata = JSON.stringify(workflow.metadata);
    if (workflow.updatedAt !== undefined) data.updatedAt = workflow.updatedAt;

    await this.prisma.workflow.update({
      where: { id },
      data,
    });
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.prisma.workflow.delete({
      where: { id },
    });
  }

  // ==================== Session Operations ====================

  async createSession(session: Session): Promise<void> {
    await this.prisma.session.create({
      data: {
        id: session.id,
        workflowId: session.workflowId,
        workflowSnapshot: JSON.stringify(session.workflowSnapshot),
        status: session.status,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        metadata: session.metadata ? JSON.stringify(session.metadata) : null,
      },
    });
  }

  async getSession(id: string): Promise<Session | null> {
    const session = await this.prisma.session.findUnique({
      where: { id },
    });

    if (!session) return null;

    return {
      id: session.id,
      workflowId: session.workflowId,
      workflowSnapshot: JSON.parse(session.workflowSnapshot) as Workflow,
      status: session.status as any,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      metadata: session.metadata ? JSON.parse(session.metadata) : undefined,
    };
  }

  async listSessions(filter?: QueryFilter<Session>): Promise<Session[]> {
    const sessions = await this.prisma.session.findMany({
      where: this.buildWhereClause(filter?.where),
      orderBy: filter?.orderBy
        ? { [filter.orderBy.field as string]: filter.orderBy.direction }
        : undefined,
      take: filter?.limit,
      skip: filter?.offset,
    });

    return sessions.map((s) => ({
      id: s.id,
      workflowId: s.workflowId,
      workflowSnapshot: JSON.parse(s.workflowSnapshot) as Workflow,
      status: s.status as any,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      metadata: s.metadata ? JSON.parse(s.metadata) : undefined,
    }));
  }

  async updateSession(id: string, session: Partial<Session>): Promise<void> {
    const data: any = {};

    if (session.status !== undefined) data.status = session.status;
    if (session.metadata !== undefined)
      data.metadata = JSON.stringify(session.metadata);
    if (session.updatedAt !== undefined) data.updatedAt = session.updatedAt;

    await this.prisma.session.update({
      where: { id },
      data,
    });
  }

  async deleteSession(id: string): Promise<void> {
    await this.prisma.session.delete({
      where: { id },
    });
  }

  // ==================== Execution State Operations ====================

  async saveExecutionState(state: WorkflowExecutionState): Promise<void> {
    // First create or update the execution state
    await this.prisma.executionState.upsert({
      where: { sessionId: state.sessionId },
      create: {
        sessionId: state.sessionId,
        budgetPoolId: state.budgetPoolId,
        currentNodeId: state.currentNodeId,
        status: state.status,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        metadata: JSON.stringify({
          budgetPoolId: state.budgetPoolId,
          startedAt: state.startedAt,
          metadata: state.metadata,
        }),
      },
      update: {
        currentNodeId: state.currentNodeId,
        status: state.status,
        completedAt: state.completedAt,
        metadata: JSON.stringify({
          budgetPoolId: state.budgetPoolId,
          startedAt: state.startedAt,
          metadata: state.metadata,
        }),
      },
    });

    // Save node states
    for (const [nodeId, nodeState] of Object.entries(state.nodeStates)) {
      await this.updateNodeState(state.sessionId, nodeId, nodeState);
    }
  }

  async getExecutionState(
    sessionId: string
  ): Promise<WorkflowExecutionState | null> {
    const execState = await this.prisma.executionState.findUnique({
      where: { sessionId },
    });

    if (!execState) return null;

    const metadata = execState.metadata
      ? JSON.parse(execState.metadata)
      : {};

    // Get all node states
    const nodeStates = await this.prisma.nodeExecutionState.findMany({
      where: { sessionId },
    });

    const nodeStatesMap: Record<string, NodeExecutionState> = {};
    for (const ns of nodeStates) {
      nodeStatesMap[ns.nodeId] = {
        nodeId: ns.nodeId,
        status: ns.status as any,
        input: ns.input ? JSON.parse(ns.input) : undefined,
        output: ns.output ? JSON.parse(ns.output) : undefined,
        error: ns.error || undefined,
        startedAt: ns.startedAt || undefined,
        completedAt: ns.completedAt || undefined,
        retryCount: ns.retryCount,
        pendingApprovalId: ns.pendingApprovalId || undefined,
        metadata: ns.metadata ? JSON.parse(ns.metadata) : undefined,
      };
    }

    return {
      sessionId,
      budgetPoolId: metadata.budgetPoolId,
      startedAt: metadata.startedAt ? new Date(metadata.startedAt) : new Date(),
      currentNodeId: execState.currentNodeId || undefined,
      completedAt: execState.completedAt || undefined,
      status: execState.status as any,
      nodeStates: nodeStatesMap,
      metadata: metadata.metadata,
    };
  }

  async updateNodeState(
    sessionId: string,
    nodeId: string,
    state: NodeExecutionState
  ): Promise<void> {
    await this.prisma.nodeExecutionState.upsert({
      where: {
        sessionId_nodeId: {
          sessionId,
          nodeId,
        },
      },
      create: {
        sessionId,
        nodeId,
        status: state.status,
        input: state.input ? JSON.stringify(state.input) : null,
        output: state.output ? JSON.stringify(state.output) : null,
        error: state.error,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        retryCount: state.retryCount || 0,
        pendingApprovalId: state.pendingApprovalId,
        metadata: state.metadata ? JSON.stringify(state.metadata) : null,
      },
      update: {
        status: state.status,
        input: state.input ? JSON.stringify(state.input) : null,
        output: state.output ? JSON.stringify(state.output) : null,
        error: state.error,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        retryCount: state.retryCount || 0,
        pendingApprovalId: state.pendingApprovalId,
        metadata: state.metadata ? JSON.stringify(state.metadata) : null,
      },
    });
  }

  // ==================== LLM Execution Operations ====================

  async saveLLMExecution(
    sessionId: string,
    nodeId: string,
    result: LLMExecutionResult & { id: string; timestamp: Date }
  ): Promise<void> {
    await this.prisma.lLMExecution.create({
      data: {
        id: result.id,
        sessionId,
        nodeId,
        timestamp: result.timestamp,
        success: result.success,
        text: result.text,
        toolCalls: result.toolCalls
          ? JSON.stringify(result.toolCalls)
          : null,
        usage_promptTokens: result.usage?.promptTokens,
        usage_completionTokens: result.usage?.completionTokens,
        usage_totalTokens: result.usage?.totalTokens,
        error: result.error,
        metadata: result.metadata ? JSON.stringify(result.metadata) : null,
      },
    });
  }

  async getLLMExecutions(
    sessionId: string,
    filter?: QueryFilter<LLMExecutionResult & { id: string; timestamp: Date }>
  ): Promise<(LLMExecutionResult & { id: string; timestamp: Date })[]> {
    const executions = await this.prisma.lLMExecution.findMany({
      where: {
        sessionId,
        ...this.buildWhereClause(filter?.where),
      },
      orderBy: filter?.orderBy
        ? { [filter.orderBy.field as string]: filter.orderBy.direction }
        : undefined,
      take: filter?.limit,
      skip: filter?.offset,
    });

    return executions.map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      success: e.success,
      text: e.text || undefined,
      toolCalls: e.toolCalls ? JSON.parse(e.toolCalls) : undefined,
      usage: {
        promptTokens: e.usage_promptTokens || 0,
        completionTokens: e.usage_completionTokens || 0,
        totalTokens: e.usage_totalTokens || 0,
      },
      error: e.error || undefined,
      metadata: e.metadata ? JSON.parse(e.metadata) : undefined,
    }));
  }

  async getNodeLLMExecutions(
    sessionId: string,
    nodeId: string
  ): Promise<(LLMExecutionResult & { id: string; timestamp: Date })[]> {
    const executions = await this.prisma.lLMExecution.findMany({
      where: { sessionId, nodeId },
      orderBy: { timestamp: "asc" },
    });

    return executions.map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      success: e.success,
      text: e.text || undefined,
      toolCalls: e.toolCalls ? JSON.parse(e.toolCalls) : undefined,
      usage: {
        promptTokens: e.usage_promptTokens || 0,
        completionTokens: e.usage_completionTokens || 0,
        totalTokens: e.usage_totalTokens || 0,
      },
      error: e.error || undefined,
      metadata: e.metadata ? JSON.parse(e.metadata) : undefined,
    }));
  }

  // ==================== Budget Pool Operations ====================

  async createBudgetPool(pool: BudgetPool): Promise<void> {
    await this.prisma.budgetPool.create({
      data: {
        id: pool.id,
        parentPoolId: pool.parentPoolId,
        totalBudget: pool.totalBudget,
        usedBudget: pool.usedBudget,
        remainingBudget: pool.remainingBudget,
        status: pool.status,
        createdAt: pool.createdAt,
        metadata: pool.metadata ? JSON.stringify(pool.metadata) : null,
      },
    });
  }

  async getBudgetPool(id: string): Promise<BudgetPool | null> {
    const pool = await this.prisma.budgetPool.findUnique({
      where: { id },
    });

    if (!pool) return null;

    return {
      id: pool.id,
      parentPoolId: pool.parentPoolId || undefined,
      totalBudget: pool.totalBudget,
      usedBudget: pool.usedBudget,
      remainingBudget: pool.remainingBudget,
      status: pool.status as any,
      createdAt: pool.createdAt,
      metadata: pool.metadata ? JSON.parse(pool.metadata) : undefined,
    };
  }

  async updateBudgetPool(
    id: string,
    pool: Partial<BudgetPool>
  ): Promise<void> {
    const data: any = {};

    if (pool.totalBudget !== undefined) data.totalBudget = pool.totalBudget;
    if (pool.usedBudget !== undefined) data.usedBudget = pool.usedBudget;
    if (pool.remainingBudget !== undefined)
      data.remainingBudget = pool.remainingBudget;
    if (pool.status !== undefined) data.status = pool.status;
    if (pool.metadata !== undefined)
      data.metadata = JSON.stringify(pool.metadata);

    await this.prisma.budgetPool.update({
      where: { id },
      data,
    });
  }

  async getChildBudgetPools(parentId: string): Promise<BudgetPool[]> {
    const pools = await this.prisma.budgetPool.findMany({
      where: { parentPoolId: parentId },
    });

    return pools.map((p) => ({
      id: p.id,
      parentPoolId: p.parentPoolId || undefined,
      totalBudget: p.totalBudget,
      usedBudget: p.usedBudget,
      remainingBudget: p.remainingBudget,
      status: p.status as any,
      createdAt: p.createdAt,
      metadata: p.metadata ? JSON.parse(p.metadata) : undefined,
    }));
  }

  // ==================== Tool Call Operations ====================

  async logToolCall(log: ToolCallLog): Promise<void> {
    await this.prisma.toolCallLog.create({
      data: {
        id: log.id,
        executionId: log.executionId,
        toolCallId: log.toolCallId,
        toolName: log.toolName,
        args: JSON.stringify(log.args),
        result: log.result ? JSON.stringify(log.result) : null,
        error: log.error,
        timestamp: log.timestamp,
        duration: log.duration,
      },
    });
  }

  async getToolCalls(executionId: string): Promise<ToolCallLog[]> {
    const logs = await this.prisma.toolCallLog.findMany({
      where: { executionId },
      orderBy: { timestamp: "asc" },
    });

    return logs.map((l) => ({
      id: l.id,
      executionId: l.executionId,
      toolCallId: l.toolCallId,
      toolName: l.toolName,
      args: JSON.parse(l.args),
      result: l.result ? JSON.parse(l.result) : undefined,
      error: l.error || undefined,
      timestamp: l.timestamp,
      duration: l.duration || undefined,
    }));
  }

  async getSessionToolCalls(
    sessionId: string,
    filter?: QueryFilter<ToolCallLog>
  ): Promise<ToolCallLog[]> {
    // First get all LLM executions for this session
    const executions = await this.prisma.lLMExecution.findMany({
      where: { sessionId },
      select: { id: true },
    });

    const executionIds = executions.map((e) => e.id);

    const logs = await this.prisma.toolCallLog.findMany({
      where: {
        executionId: { in: executionIds },
        ...this.buildWhereClause(filter?.where),
      },
      orderBy: filter?.orderBy
        ? { [filter.orderBy.field as string]: filter.orderBy.direction }
        : { timestamp: "asc" },
      take: filter?.limit,
      skip: filter?.offset,
    });

    return logs.map((l) => ({
      id: l.id,
      executionId: l.executionId,
      toolCallId: l.toolCallId,
      toolName: l.toolName,
      args: JSON.parse(l.args),
      result: l.result ? JSON.parse(l.result) : undefined,
      error: l.error || undefined,
      timestamp: l.timestamp,
      duration: l.duration || undefined,
    }));
  }

  // ==================== Approval Operations ====================

  async createApprovalRequest(request: ApprovalRequest): Promise<void> {
    await this.prisma.approvalRequest.create({
      data: {
        id: request.id,
        sessionId: request.sessionId,
        nodeId: request.nodeId,
        type: request.type,
        status: request.status,
        context: JSON.stringify(request.context),
        createdAt: request.createdAt,
        resolvedAt: request.resolvedAt,
        resolvedBy: request.resolvedBy,
        resolutionNotes: request.resolutionNotes,
      },
    });
  }

  async getApprovalRequest(id: string): Promise<ApprovalRequest | null> {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id },
    });

    if (!request) return null;

    return {
      id: request.id,
      sessionId: request.sessionId,
      nodeId: request.nodeId,
      type: request.type as any,
      status: request.status as any,
      context: JSON.parse(request.context),
      createdAt: request.createdAt,
      resolvedAt: request.resolvedAt || undefined,
      resolvedBy: request.resolvedBy || undefined,
      resolutionNotes: request.resolutionNotes || undefined,
    };
  }

  async listApprovalRequests(
    sessionId: string,
    filter?: QueryFilter<ApprovalRequest>
  ): Promise<ApprovalRequest[]> {
    const requests = await this.prisma.approvalRequest.findMany({
      where: {
        sessionId,
        ...this.buildWhereClause(filter?.where),
      },
      orderBy: filter?.orderBy
        ? { [filter.orderBy.field as string]: filter.orderBy.direction }
        : { createdAt: "asc" },
      take: filter?.limit,
      skip: filter?.offset,
    });

    return requests.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      nodeId: r.nodeId,
      type: r.type as any,
      status: r.status as any,
      context: JSON.parse(r.context),
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt || undefined,
      resolvedBy: r.resolvedBy || undefined,
      resolutionNotes: r.resolutionNotes || undefined,
    }));
  }

  async listPendingApprovals(
    filter?: QueryFilter<ApprovalRequest>
  ): Promise<ApprovalRequest[]> {
    const requests = await this.prisma.approvalRequest.findMany({
      where: {
        status: "pending",
        ...this.buildWhereClause(filter?.where),
      },
      orderBy: filter?.orderBy
        ? { [filter.orderBy.field as string]: filter.orderBy.direction }
        : { createdAt: "asc" },
      take: filter?.limit,
      skip: filter?.offset,
    });

    return requests.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      nodeId: r.nodeId,
      type: r.type as any,
      status: r.status as any,
      context: JSON.parse(r.context),
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt || undefined,
      resolvedBy: r.resolvedBy || undefined,
      resolutionNotes: r.resolutionNotes || undefined,
    }));
  }

  async updateApprovalRequest(
    id: string,
    update: Partial<ApprovalRequest>
  ): Promise<void> {
    const data: any = {};

    if (update.status !== undefined) data.status = update.status;
    if (update.resolvedAt !== undefined) data.resolvedAt = update.resolvedAt;
    if (update.resolvedBy !== undefined) data.resolvedBy = update.resolvedBy;
    if (update.resolutionNotes !== undefined)
      data.resolutionNotes = update.resolutionNotes;
    if (update.context !== undefined)
      data.context = JSON.stringify(update.context);

    await this.prisma.approvalRequest.update({
      where: { id },
      data,
    });
  }

  async approveRequest(
    id: string,
    approvedBy: string,
    notes?: string
  ): Promise<void> {
    await this.prisma.approvalRequest.update({
      where: { id },
      data: {
        status: "approved",
        resolvedAt: new Date(),
        resolvedBy: approvedBy,
        resolutionNotes: notes,
      },
    });
  }

  async rejectRequest(
    id: string,
    rejectedBy: string,
    reason?: string
  ): Promise<void> {
    await this.prisma.approvalRequest.update({
      where: { id },
      data: {
        status: "rejected",
        resolvedAt: new Date(),
        resolvedBy: rejectedBy,
        resolutionNotes: reason,
      },
    });
  }

  // ==================== Stream Operations (Optional) ====================

  async saveStreamEvent(event: StreamEvent): Promise<void> {
    await this.prisma.streamEvent.create({
      data: {
        id: event.id,
        streamId: event.streamId,
        nodeId: event.nodeId,
        data: JSON.stringify(event.data),
        timestamp: event.timestamp,
      },
    });
  }

  async getStreamEvents(
    streamId: string,
    filter?: QueryFilter<StreamEvent>
  ): Promise<StreamEvent[]> {
    const events = await this.prisma.streamEvent.findMany({
      where: {
        streamId,
        ...this.buildWhereClause(filter?.where),
      },
      orderBy: filter?.orderBy
        ? { [filter.orderBy.field as string]: filter.orderBy.direction }
        : { timestamp: "asc" },
      take: filter?.limit,
      skip: filter?.offset,
    });

    return events.map((e) => ({
      id: e.id,
      streamId: e.streamId,
      nodeId: e.nodeId,
      data: JSON.parse(e.data),
      timestamp: e.timestamp,
    }));
  }

  // ==================== Helper Methods ====================

  private buildWhereClause(where?: Partial<any>): any {
    if (!where) return {};

    const clause: any = {};

    for (const [key, value] of Object.entries(where)) {
      if (value !== undefined && value !== null) {
        clause[key] = value;
      }
    }

    return clause;
  }
}
