import type {
  Workflow,
  WorkflowNode,
  WorkflowNodeGroup,
  WorkflowNodeLLM,
  WorkflowNodeTransform,
  WorkflowNodeCallWorkflow,
  Session,
  StorageAdapter,
  NodeExecutionState,
  WorkflowExecutionState,
  ToolRegistry,
  ApprovalRequest,
} from "@aaow/types";
import { BudgetPoolManager } from "./budget";
import { executeTransform } from "./executors/transform";
import { executeLLM } from "./executors/llm";

export interface WorkflowEngineOptions {
  /** Storage adapter for persistence */
  storage: StorageAdapter;

  /** Tool registry for custom tools */
  tools?: ToolRegistry;

  /** Language model for LLM nodes */
  model?: any; // AI SDK's LanguageModel type

  /** Budget pool ID for this execution */
  budgetPoolId?: string;

  /** Metadata for the session */
  metadata?: Record<string, unknown>;
}

/**
 * Workflow Engine
 *
 * Executes workflows by traversing the graph and executing nodes
 */
export class WorkflowEngine {
  private budgetManager: BudgetPoolManager;
  private storage: StorageAdapter;
  private tools: ToolRegistry;
  private model?: any;

  constructor(options: WorkflowEngineOptions) {
    this.storage = options.storage;
    this.budgetManager = new BudgetPoolManager(options.storage);
    this.tools = options.tools || {};
    this.model = options.model;
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflow: Workflow,
    workflowId: string,
    input: unknown,
    options?: { sessionId?: string; budgetPoolId?: string }
  ): Promise<{ sessionId: string; output: unknown; success: boolean }> {
    // Create session
    const sessionId = options?.sessionId || `session-${Date.now()}`;
    const session: Session = {
      id: sessionId,
      workflowId,
      workflowSnapshot: workflow,
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
    };

    await this.storage.createSession(session);

    // Initialize execution state
    const executionState: WorkflowExecutionState = {
      sessionId,
      budgetPoolId: options?.budgetPoolId,
      status: "running",
      startedAt: new Date(),
      nodeStates: {},
    };

    await this.storage.saveExecutionState(executionState);

    try {
      // Execute root group node
      const output = await this.executeNode(
        workflow.root,
        "root",
        input,
        sessionId,
        options?.budgetPoolId
      );

      // Update session status
      await this.storage.updateSession(sessionId, {
        status: "completed",
        updatedAt: new Date(),
      });

      // Update execution state
      await this.storage.saveExecutionState({
        ...executionState,
        status: "completed",
        completedAt: new Date(),
      });

      return { sessionId, output, success: true };
    } catch (error) {
      // Update session status on error
      await this.storage.updateSession(sessionId, {
        status: "failed",
        updatedAt: new Date(),
      });

      // Update execution state
      await this.storage.saveExecutionState({
        ...executionState,
        status: "failed",
        completedAt: new Date(),
      });

      throw error;
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: WorkflowNode,
    nodeId: string,
    input: unknown,
    sessionId: string,
    budgetPoolId?: string
  ): Promise<unknown> {
    // Update node state to running
    const nodeState: NodeExecutionState = {
      nodeId,
      status: "running",
      input,
      startedAt: new Date(),
    };
    await this.storage.updateNodeState(sessionId, nodeId, nodeState);

    try {
      let output: unknown;

      switch (node.type) {
        case "group":
          output = await this.executeGroupNode(
            node,
            nodeId,
            input,
            sessionId,
            budgetPoolId
          );
          break;

        case "llm":
          output = await this.executeLLMNode(
            node,
            nodeId,
            input,
            sessionId,
            budgetPoolId
          );
          break;

        case "transform":
          output = await this.executeTransformNode(node, input);
          break;

        case "callWorkflow":
          output = await this.executeCallWorkflowNode(
            node,
            nodeId,
            input,
            sessionId,
            budgetPoolId
          );
          break;

        case "stream":
        case "generator":
          throw new Error(
            `Node type ${node.type} is not yet implemented`
          );

        default:
          throw new Error(`Unknown node type: ${(node as any).type}`);
      }

      // Update node state to completed
      await this.storage.updateNodeState(sessionId, nodeId, {
        ...nodeState,
        status: "completed",
        output,
        completedAt: new Date(),
      });

      return output;
    } catch (error) {
      // Update node state to failed
      await this.storage.updateNodeState(sessionId, nodeId, {
        ...nodeState,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      });

      throw error;
    }
  }

  /**
   * Execute a group node
   */
  private async executeGroupNode(
    node: WorkflowNodeGroup,
    nodeId: string,
    input: unknown,
    sessionId: string,
    budgetPoolId?: string
  ): Promise<unknown> {
    // Start from entry point
    let currentNodeId = node.entryPoint;
    let currentInput = input;

    const executedNodes = new Set<string>();

    while (currentNodeId !== node.exitPoint) {
      if (executedNodes.has(currentNodeId)) {
        throw new Error(`Cycle detected at node ${currentNodeId}`);
      }
      executedNodes.add(currentNodeId);

      const currentNode = node.nodes[currentNodeId];
      if (!currentNode) {
        throw new Error(`Node ${currentNodeId} not found in group ${nodeId}`);
      }

      // Execute current node
      const output = await this.executeNode(
        currentNode,
        `${nodeId}.${currentNodeId}`,
        currentInput,
        sessionId,
        budgetPoolId
      );

      // Find next edge
      const nextEdge = node.edges.find((e) => e.from === currentNodeId);
      if (!nextEdge) {
        throw new Error(`No outgoing edge found for node ${currentNodeId}`);
      }

      // Extract output based on edge configuration
      if (nextEdge.previousNodeMessageOutputFieldName && typeof output === "object" && output !== null) {
        currentInput = (output as any)[nextEdge.previousNodeMessageOutputFieldName];
      } else {
        currentInput = output;
      }

      currentNodeId = nextEdge.to;
    }

    return currentInput;
  }

  /**
   * Execute an LLM node
   */
  private async executeLLMNode(
    node: WorkflowNodeLLM,
    nodeId: string,
    input: unknown,
    sessionId: string,
    budgetPoolId?: string
  ): Promise<unknown> {
    if (!this.model) {
      throw new Error("No language model configured for LLM node execution");
    }

    // Check if human review is required
    if (node.requiresHumanReview) {
      const approvalId = `approval-${sessionId}-${nodeId}-${Date.now()}`;
      const approvalRequest: ApprovalRequest = {
        id: approvalId,
        sessionId,
        nodeId,
        type: "human_review",
        status: "pending",
        context: {
          description: "Human review required for LLM node",
          llmOutput: input,
        },
        createdAt: new Date(),
      };

      await this.storage.createApprovalRequest(approvalRequest);

      // Update session status
      await this.storage.updateSession(sessionId, {
        status: "waiting_for_human_review",
      });

      throw new Error(
        `Human review required. Approval request: ${approvalId}`
      );
    }

    // Build tools from available tools
    const nodeTools: ToolRegistry = {};
    if (node.availableTools) {
      for (const tool of node.availableTools) {
        if (tool.type === "custom") {
          const toolDef = this.tools[tool.name];
          if (toolDef) {
            nodeTools[tool.name] = toolDef;
          }
        }
      }
    }

    // Execute LLM
    const result = await executeLLM(input, {
      model: this.model,
      systemPrompt: node.systemPrompt,
      tools: nodeTools,
      maxRetries: node.maxRetries,
      storage: this.storage,
      sessionId,
      nodeId,
    });

    // Save LLM execution result
    await this.storage.saveLLMExecution(sessionId, nodeId, {
      id: `llm-${sessionId}-${nodeId}-${Date.now()}`,
      timestamp: new Date(),
      ...result,
    });

    // Consume budget if available
    if (budgetPoolId && result.usage) {
      await this.budgetManager.consumeBudget(
        budgetPoolId,
        result.usage.totalTokens
      );
    }

    if (!result.success) {
      throw new Error(result.error || "LLM execution failed");
    }

    return result.text;
  }

  /**
   * Execute a transform node
   */
  private async executeTransformNode(
    node: WorkflowNodeTransform,
    input: unknown
  ): Promise<unknown> {
    return executeTransform(node.fn, input);
  }

  /**
   * Execute a callWorkflow node
   */
  private async executeCallWorkflowNode(
    node: WorkflowNodeCallWorkflow,
    nodeId: string,
    input: unknown,
    sessionId: string,
    budgetPoolId?: string
  ): Promise<unknown> {
    // Check if approval is required
    if (node.requiresApproval) {
      const approvalId = `approval-${sessionId}-${nodeId}-${Date.now()}`;
      const approvalRequest: ApprovalRequest = {
        id: approvalId,
        sessionId,
        nodeId,
        type: "workflow_call",
        status: "pending",
        context: {
          description: "Approval required for workflow call",
          workflowRef: node.workflowRef,
        },
        createdAt: new Date(),
      };

      await this.storage.createApprovalRequest(approvalRequest);

      // Update session status
      await this.storage.updateSession(sessionId, {
        status: "waiting_for_workflow_approval",
      });

      throw new Error(
        `Workflow call approval required. Approval request: ${approvalId}`
      );
    }

    // Get referenced workflow
    const workflow = await this.storage.getWorkflow(node.workflowRef);
    if (!workflow) {
      throw new Error(`Workflow ${node.workflowRef} not found`);
    }

    // Map input if needed
    let mappedInput = input;
    if (node.inputMapping) {
      mappedInput = await executeTransform(node.inputMapping, input);
    }

    // Execute workflow
    const result = await this.executeWorkflow(
      workflow.definition,
      node.workflowRef,
      mappedInput,
      { budgetPoolId }
    );

    // Map output if needed
    let mappedOutput = result.output;
    if (node.outputMapping) {
      mappedOutput = await executeTransform(node.outputMapping, result.output);
    }

    return mappedOutput;
  }

  /**
   * Resume a paused session
   */
  async resumeSession(sessionId: string, approvalId: string): Promise<void> {
    const approval = await this.storage.getApprovalRequest(approvalId);
    if (!approval) {
      throw new Error(`Approval request ${approvalId} not found`);
    }

    if (approval.status !== "approved") {
      throw new Error(`Approval request ${approvalId} is not approved`);
    }

    // Resume execution based on approval type
    // This would require storing execution state and resuming from the paused point
    // For now, just update the session status
    await this.storage.updateSession(sessionId, {
      status: "running",
      updatedAt: new Date(),
    });
  }
}
