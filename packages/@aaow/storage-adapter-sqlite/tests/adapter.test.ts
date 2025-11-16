import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import { SQLiteStorageAdapter } from "../src/adapter";
import type {
  StoredWorkflow,
  Session,
  WorkflowExecutionState,
  BudgetPool,
  ApprovalRequest,
  ToolCallLog,
} from "@aaow/types";

// Use a file-based database for tests instead of in-memory
const TEST_DB_URL = "file:./test.db";

// Helper to create a test adapter with test database
function createTestAdapter() {
  return new SQLiteStorageAdapter(TEST_DB_URL);
}

// Setup test database schema (run once)
let dbInitialized = false;
async function setupTestDatabase(adapter?: SQLiteStorageAdapter) {
  if (!dbInitialized) {
    const fs = require("fs");
    const path = require("path");

    // Remove existing test database
    const dbPath = path.join(__dirname, "..", "test.db");
    const journalPath = path.join(__dirname, "..", "test.db-journal");
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      if (fs.existsSync(journalPath)) fs.unlinkSync(journalPath);
    } catch (e) {
      // Ignore
    }

    // Read migration SQL
    const migrationPath = path.join(__dirname, "..", "prisma/migrations/20251116142851_init/migration.sql");
    const migrationSQL = fs.readFileSync(migrationPath, "utf-8");

    // Create a temporary adapter to execute the migration
    const tmpAdapter = adapter || new SQLiteStorageAdapter(TEST_DB_URL);
    await tmpAdapter.initialize();

    // Execute migration SQL
    const statements = migrationSQL
      .split(";")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      await (tmpAdapter as any).prisma.$executeRawUnsafe(statement);
    }

    if (!adapter) {
      await tmpAdapter.close();
    }

    dbInitialized = true;
  }
}

// Clean all data from test database
async function cleanTestDatabase(adapter: SQLiteStorageAdapter) {
  // Delete all data in reverse order of dependencies
  await (adapter as any).prisma.$executeRaw`DELETE FROM stream_events`;
  await (adapter as any).prisma.$executeRaw`DELETE FROM tool_call_logs`;
  await (adapter as any).prisma.$executeRaw`DELETE FROM approval_requests`;
  await (adapter as any).prisma.$executeRaw`DELETE FROM llm_executions`;
  await (adapter as any).prisma.$executeRaw`DELETE FROM node_execution_states`;
  await (adapter as any).prisma.$executeRaw`DELETE FROM execution_states`;
  await (adapter as any).prisma.$executeRaw`DELETE FROM sessions`;
  await (adapter as any).prisma.$executeRaw`DELETE FROM budget_pools`;
  await (adapter as any).prisma.$executeRaw`DELETE FROM workflows`;
}

// Mock workflow definition
const mockWorkflow = {
  root: {
    id: "root",
    type: "group" as const,
    nodes: [],
    edges: [],
    groups: [],
  },
  typedefs: {},
};

describe("SQLiteStorageAdapter", () => {
  let adapter: SQLiteStorageAdapter;

  beforeEach(async () => {
    adapter = createTestAdapter();
    await adapter.initialize();
    await setupTestDatabase(adapter);
    await cleanTestDatabase(adapter);
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe("Initialization", () => {
    it("should initialize successfully", async () => {
      const newAdapter = createTestAdapter();
      await expect(newAdapter.initialize()).resolves.not.toThrow();
      await newAdapter.close();
    });

    it("should close successfully", async () => {
      await expect(adapter.close()).resolves.not.toThrow();
      // Re-initialize for cleanup
      await adapter.initialize();
    });
  });

  describe("Workflow Operations", () => {
    const testWorkflow: StoredWorkflow = {
      id: "wf-1",
      name: "Test Workflow",
      version: "1.0.0",
      definition: mockWorkflow,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { author: "test" },
    };

    it("should save a workflow", async () => {
      await expect(adapter.saveWorkflow(testWorkflow)).resolves.not.toThrow();
    });

    it("should retrieve a saved workflow", async () => {
      await adapter.saveWorkflow(testWorkflow);
      const retrieved = await adapter.getWorkflow("wf-1");

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe("wf-1");
      expect(retrieved?.name).toBe("Test Workflow");
      expect(retrieved?.version).toBe("1.0.0");
      expect(retrieved?.metadata).toEqual({ author: "test" });
    });

    it("should return null for non-existent workflow", async () => {
      const result = await adapter.getWorkflow("non-existent");
      expect(result).toBeNull();
    });

    it("should list workflows", async () => {
      await adapter.saveWorkflow(testWorkflow);
      await adapter.saveWorkflow({
        ...testWorkflow,
        id: "wf-2",
        name: "Another Workflow",
      });

      const workflows = await adapter.listWorkflows();
      expect(workflows).toHaveLength(2);
    });

    it("should list workflows with filtering", async () => {
      await adapter.saveWorkflow(testWorkflow);
      await adapter.saveWorkflow({
        ...testWorkflow,
        id: "wf-2",
        name: "Another Workflow",
        version: "2.0.0",
      });

      const workflows = await adapter.listWorkflows({
        where: { version: "1.0.0" },
      });

      expect(workflows).toHaveLength(1);
      expect(workflows[0].version).toBe("1.0.0");
    });

    it("should list workflows with limit and offset", async () => {
      for (let i = 0; i < 5; i++) {
        await adapter.saveWorkflow({
          ...testWorkflow,
          id: `wf-${i}`,
        });
      }

      const page1 = await adapter.listWorkflows({ limit: 2, offset: 0 });
      const page2 = await adapter.listWorkflows({ limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    it("should update a workflow", async () => {
      await adapter.saveWorkflow(testWorkflow);
      await adapter.updateWorkflow("wf-1", { version: "2.0.0" });

      const updated = await adapter.getWorkflow("wf-1");
      expect(updated?.version).toBe("2.0.0");
    });

    it("should delete a workflow", async () => {
      await adapter.saveWorkflow(testWorkflow);
      await adapter.deleteWorkflow("wf-1");

      const deleted = await adapter.getWorkflow("wf-1");
      expect(deleted).toBeNull();
    });
  });

  describe("Session Operations", () => {
    const testSession: Session = {
      id: "session-1",
      workflowId: "wf-1",
      workflowSnapshot: mockWorkflow,
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { user: "test-user" },
    };

    beforeEach(async () => {
      // Create a workflow first for foreign key
      await adapter.saveWorkflow({
        id: "wf-1",
        name: "Test",
        version: "1.0.0",
        definition: mockWorkflow,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it("should create a session", async () => {
      await expect(adapter.createSession(testSession)).resolves.not.toThrow();
    });

    it("should retrieve a session", async () => {
      await adapter.createSession(testSession);
      const retrieved = await adapter.getSession("session-1");

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe("session-1");
      expect(retrieved?.workflowId).toBe("wf-1");
      expect(retrieved?.status).toBe("running");
      expect(retrieved?.workflowSnapshot).toEqual(mockWorkflow);
    });

    it("should list sessions", async () => {
      await adapter.createSession(testSession);
      await adapter.createSession({
        ...testSession,
        id: "session-2",
      });

      const sessions = await adapter.listSessions();
      expect(sessions).toHaveLength(2);
    });

    it("should list sessions by status", async () => {
      await adapter.createSession(testSession);
      await adapter.createSession({
        ...testSession,
        id: "session-2",
        status: "completed",
      });

      const running = await adapter.listSessions({
        where: { status: "running" },
      });

      expect(running).toHaveLength(1);
      expect(running[0].status).toBe("running");
    });

    it("should update a session", async () => {
      await adapter.createSession(testSession);
      await adapter.updateSession("session-1", { status: "completed" });

      const updated = await adapter.getSession("session-1");
      expect(updated?.status).toBe("completed");
    });

    it("should delete a session", async () => {
      await adapter.createSession(testSession);
      await adapter.deleteSession("session-1");

      const deleted = await adapter.getSession("session-1");
      expect(deleted).toBeNull();
    });
  });

  describe("Execution State Operations", () => {
    const testExecutionState: WorkflowExecutionState = {
      sessionId: "session-1",
      budgetPoolId: "pool-1",
      startedAt: new Date(),
      currentNodeId: "node-1",
      status: "running",
      nodeStates: {
        "node-1": {
          nodeId: "node-1",
          status: "running",
          startedAt: new Date(),
        },
      },
    };

    beforeEach(async () => {
      await adapter.saveWorkflow({
        id: "wf-1",
        name: "Test",
        version: "1.0.0",
        definition: mockWorkflow,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await adapter.createSession({
        id: "session-1",
        workflowId: "wf-1",
        workflowSnapshot: mockWorkflow,
        status: "running",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it("should save execution state", async () => {
      await expect(
        adapter.saveExecutionState(testExecutionState)
      ).resolves.not.toThrow();
    });

    it("should retrieve execution state", async () => {
      await adapter.saveExecutionState(testExecutionState);
      const retrieved = await adapter.getExecutionState("session-1");

      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe("session-1");
      expect(retrieved?.currentNodeId).toBe("node-1");
      expect(retrieved?.nodeStates["node-1"]).toBeDefined();
    });

    it("should update node state", async () => {
      await adapter.saveExecutionState(testExecutionState);
      await adapter.updateNodeState("session-1", "node-1", {
        nodeId: "node-1",
        status: "completed",
        completedAt: new Date(),
        output: { result: "success" },
      });

      const state = await adapter.getExecutionState("session-1");
      expect(state?.nodeStates["node-1"].status).toBe("completed");
      expect(state?.nodeStates["node-1"].output).toEqual({ result: "success" });
    });

    it("should handle multiple node states", async () => {
      await adapter.saveExecutionState({
        ...testExecutionState,
        nodeStates: {
          "node-1": { nodeId: "node-1", status: "completed" },
          "node-2": { nodeId: "node-2", status: "running" },
          "node-3": { nodeId: "node-3", status: "pending" },
        },
      });

      const state = await adapter.getExecutionState("session-1");
      expect(Object.keys(state?.nodeStates || {})).toHaveLength(3);
    });
  });

  describe("LLM Execution Operations", () => {
    beforeEach(async () => {
      await adapter.saveWorkflow({
        id: "wf-1",
        name: "Test",
        version: "1.0.0",
        definition: mockWorkflow,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await adapter.createSession({
        id: "session-1",
        workflowId: "wf-1",
        workflowSnapshot: mockWorkflow,
        status: "running",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it("should save LLM execution", async () => {
      await expect(
        adapter.saveLLMExecution("session-1", "node-1", {
          id: "exec-1",
          timestamp: new Date(),
          success: true,
          text: "Hello, world!",
          usage: {
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15,
          },
        })
      ).resolves.not.toThrow();
    });

    it("should retrieve LLM executions for session", async () => {
      await adapter.saveLLMExecution("session-1", "node-1", {
        id: "exec-1",
        timestamp: new Date(),
        success: true,
        text: "First",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      });
      await adapter.saveLLMExecution("session-1", "node-2", {
        id: "exec-2",
        timestamp: new Date(),
        success: true,
        text: "Second",
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
      });

      const executions = await adapter.getLLMExecutions("session-1");
      expect(executions).toHaveLength(2);
    });

    it("should retrieve LLM executions for specific node", async () => {
      await adapter.saveLLMExecution("session-1", "node-1", {
        id: "exec-1",
        timestamp: new Date(),
        success: true,
        text: "First",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      });
      await adapter.saveLLMExecution("session-1", "node-2", {
        id: "exec-2",
        timestamp: new Date(),
        success: true,
        text: "Second",
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
      });

      const executions = await adapter.getNodeLLMExecutions(
        "session-1",
        "node-1"
      );
      expect(executions).toHaveLength(1);
      expect(executions[0].text).toBe("First");
    });

    it("should store tool calls in LLM execution", async () => {
      await adapter.saveLLMExecution("session-1", "node-1", {
        id: "exec-1",
        timestamp: new Date(),
        success: true,
        toolCalls: [
          {
            toolCallId: "call-1",
            toolName: "calculator",
            args: { operation: "add", a: 1, b: 2 },
            result: 3,
          },
        ],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      });

      const executions = await adapter.getLLMExecutions("session-1");
      expect(executions[0].toolCalls).toHaveLength(1);
      expect(executions[0].toolCalls?.[0].toolName).toBe("calculator");
    });
  });

  describe("Budget Pool Operations", () => {
    const testPool: BudgetPool = {
      id: "pool-1",
      totalBudget: 1000,
      usedBudget: 100,
      remainingBudget: 900,
      status: "active",
      createdAt: new Date(),
    };

    it("should create a budget pool", async () => {
      await expect(adapter.createBudgetPool(testPool)).resolves.not.toThrow();
    });

    it("should retrieve a budget pool", async () => {
      await adapter.createBudgetPool(testPool);
      const retrieved = await adapter.getBudgetPool("pool-1");

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe("pool-1");
      expect(retrieved?.totalBudget).toBe(1000);
      expect(retrieved?.usedBudget).toBe(100);
    });

    it("should update budget pool", async () => {
      await adapter.createBudgetPool(testPool);
      await adapter.updateBudgetPool("pool-1", {
        usedBudget: 200,
        remainingBudget: 800,
      });

      const updated = await adapter.getBudgetPool("pool-1");
      expect(updated?.usedBudget).toBe(200);
      expect(updated?.remainingBudget).toBe(800);
    });

    it("should handle hierarchical budget pools", async () => {
      await adapter.createBudgetPool(testPool);
      await adapter.createBudgetPool({
        ...testPool,
        id: "pool-2",
        parentPoolId: "pool-1",
        totalBudget: 500,
      });

      const children = await adapter.getChildBudgetPools("pool-1");
      expect(children).toHaveLength(1);
      expect(children[0].id).toBe("pool-2");
      expect(children[0].parentPoolId).toBe("pool-1");
    });
  });

  describe("Tool Call Operations", () => {
    beforeEach(async () => {
      await adapter.saveWorkflow({
        id: "wf-1",
        name: "Test",
        version: "1.0.0",
        definition: mockWorkflow,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await adapter.createSession({
        id: "session-1",
        workflowId: "wf-1",
        workflowSnapshot: mockWorkflow,
        status: "running",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await adapter.saveLLMExecution("session-1", "node-1", {
        id: "exec-1",
        timestamp: new Date(),
        success: true,
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      });
    });

    it("should log a tool call", async () => {
      const toolCall: ToolCallLog = {
        id: "tc-1",
        executionId: "exec-1",
        toolCallId: "call-1",
        toolName: "calculator",
        args: { operation: "add", a: 1, b: 2 },
        result: 3,
        timestamp: new Date(),
        duration: 50,
      };

      await expect(adapter.logToolCall(toolCall)).resolves.not.toThrow();
    });

    it("should retrieve tool calls for execution", async () => {
      await adapter.logToolCall({
        id: "tc-1",
        executionId: "exec-1",
        toolCallId: "call-1",
        toolName: "calculator",
        args: { operation: "add" },
        result: 3,
        timestamp: new Date(),
      });

      const calls = await adapter.getToolCalls("exec-1");
      expect(calls).toHaveLength(1);
      expect(calls[0].toolName).toBe("calculator");
    });

    it("should retrieve tool calls for session", async () => {
      await adapter.logToolCall({
        id: "tc-1",
        executionId: "exec-1",
        toolCallId: "call-1",
        toolName: "calculator",
        args: { operation: "add" },
        result: 3,
        timestamp: new Date(),
      });

      const calls = await adapter.getSessionToolCalls("session-1");
      expect(calls).toHaveLength(1);
    });
  });

  describe("Approval Operations", () => {
    beforeEach(async () => {
      await adapter.saveWorkflow({
        id: "wf-1",
        name: "Test",
        version: "1.0.0",
        definition: mockWorkflow,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await adapter.createSession({
        id: "session-1",
        workflowId: "wf-1",
        workflowSnapshot: mockWorkflow,
        status: "running",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    const testApproval: ApprovalRequest = {
      id: "approval-1",
      sessionId: "session-1",
      nodeId: "node-1",
      type: "human_review",
      status: "pending",
      context: {
        description: "Please review this output",
        llmOutput: { text: "Generated text" },
      },
      createdAt: new Date(),
    };

    it("should create an approval request", async () => {
      await expect(
        adapter.createApprovalRequest(testApproval)
      ).resolves.not.toThrow();
    });

    it("should retrieve an approval request", async () => {
      await adapter.createApprovalRequest(testApproval);
      const retrieved = await adapter.getApprovalRequest("approval-1");

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe("approval-1");
      expect(retrieved?.type).toBe("human_review");
      expect(retrieved?.status).toBe("pending");
    });

    it("should list approval requests for session", async () => {
      await adapter.createApprovalRequest(testApproval);
      await adapter.createApprovalRequest({
        ...testApproval,
        id: "approval-2",
        type: "budget_increase",
      });

      const approvals = await adapter.listApprovalRequests("session-1");
      expect(approvals).toHaveLength(2);
    });

    it("should list pending approvals", async () => {
      await adapter.createApprovalRequest(testApproval);
      await adapter.createApprovalRequest({
        ...testApproval,
        id: "approval-2",
        status: "approved",
        resolvedAt: new Date(),
      });

      const pending = await adapter.listPendingApprovals();
      expect(pending).toHaveLength(1);
      expect(pending[0].status).toBe("pending");
    });

    it("should approve a request", async () => {
      await adapter.createApprovalRequest(testApproval);
      await adapter.approveRequest("approval-1", "user@test.com", "LGTM");

      const approved = await adapter.getApprovalRequest("approval-1");
      expect(approved?.status).toBe("approved");
      expect(approved?.resolvedBy).toBe("user@test.com");
      expect(approved?.resolutionNotes).toBe("LGTM");
      expect(approved?.resolvedAt).toBeDefined();
    });

    it("should reject a request", async () => {
      await adapter.createApprovalRequest(testApproval);
      await adapter.rejectRequest(
        "approval-1",
        "user@test.com",
        "Needs revision"
      );

      const rejected = await adapter.getApprovalRequest("approval-1");
      expect(rejected?.status).toBe("rejected");
      expect(rejected?.resolvedBy).toBe("user@test.com");
      expect(rejected?.resolutionNotes).toBe("Needs revision");
    });

    it("should update approval request", async () => {
      await adapter.createApprovalRequest(testApproval);
      await adapter.updateApprovalRequest("approval-1", {
        status: "expired",
      });

      const updated = await adapter.getApprovalRequest("approval-1");
      expect(updated?.status).toBe("expired");
    });
  });

  describe("Stream Operations", () => {
    it("should save a stream event", async () => {
      await expect(
        adapter.saveStreamEvent({
          id: "event-1",
          streamId: "stream-1",
          nodeId: "node-1",
          data: { value: 42 },
          timestamp: new Date(),
        })
      ).resolves.not.toThrow();
    });

    it("should retrieve stream events", async () => {
      await adapter.saveStreamEvent({
        id: "event-1",
        streamId: "stream-1",
        nodeId: "node-1",
        data: { value: 1 },
        timestamp: new Date(),
      });
      await adapter.saveStreamEvent({
        id: "event-2",
        streamId: "stream-1",
        nodeId: "node-1",
        data: { value: 2 },
        timestamp: new Date(),
      });

      const events = await adapter.getStreamEvents("stream-1");
      expect(events).toHaveLength(2);
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle complete workflow execution lifecycle", async () => {
      // 1. Save workflow
      await adapter.saveWorkflow({
        id: "wf-complex",
        name: "Complex Workflow",
        version: "1.0.0",
        definition: mockWorkflow,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 2. Create session
      await adapter.createSession({
        id: "session-complex",
        workflowId: "wf-complex",
        workflowSnapshot: mockWorkflow,
        status: "running",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 3. Create budget pool
      await adapter.createBudgetPool({
        id: "pool-complex",
        totalBudget: 1000,
        usedBudget: 0,
        remainingBudget: 1000,
        status: "active",
        createdAt: new Date(),
      });

      // 4. Save execution state
      await adapter.saveExecutionState({
        sessionId: "session-complex",
        budgetPoolId: "pool-complex",
        startedAt: new Date(),
        status: "running",
        nodeStates: {},
      });

      // 5. Execute LLM node
      await adapter.saveLLMExecution("session-complex", "llm-node", {
        id: "exec-complex",
        timestamp: new Date(),
        success: true,
        text: "Result",
        usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75 },
      });

      // 6. Update budget
      await adapter.updateBudgetPool("pool-complex", {
        usedBudget: 75,
        remainingBudget: 925,
      });

      // 7. Create approval request
      await adapter.createApprovalRequest({
        id: "approval-complex",
        sessionId: "session-complex",
        nodeId: "llm-node",
        type: "human_review",
        status: "pending",
        context: { description: "Review output" },
        createdAt: new Date(),
      });

      // 8. Approve
      await adapter.approveRequest("approval-complex", "reviewer", "Approved");

      // 9. Complete session
      await adapter.updateSession("session-complex", { status: "completed" });

      // Verify final state
      const session = await adapter.getSession("session-complex");
      expect(session?.status).toBe("completed");

      const pool = await adapter.getBudgetPool("pool-complex");
      expect(pool?.usedBudget).toBe(75);

      const approval = await adapter.getApprovalRequest("approval-complex");
      expect(approval?.status).toBe("approved");
    });
  });
});
