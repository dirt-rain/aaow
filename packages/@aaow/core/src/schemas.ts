import { z } from "zod";

/**
 * Zod schemas for workflow validation
 */

// Workflow Node Message Types
export const WorkflowNodeMessageTypeSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal("string") }),
    z.object({ type: z.literal("enum"), value: z.array(z.string()) }),
    z.object({
      type: z.literal("array"),
      of: WorkflowNodeMessageTypeSchema,
    }),
    z.object({
      type: z.literal("optional"),
      of: WorkflowNodeMessageTypeSchema,
    }),
    z.object({
      type: z.literal("object"),
      value: z.record(
        z.string(),
        z.object({
          description: z.string(),
          type: WorkflowNodeMessageTypeSchema,
        })
      ),
    }),
    z.object({
      type: z.literal("taggedUnion"),
      value: z.record(
        z.string(),
        z.object({
          description: z.string(),
          type: WorkflowNodeMessageTypeSchema,
        })
      ),
    }),
    z.object({ type: z.literal("ref"), ref: z.string() }),
  ])
);

// Transform Functions
export const WorkflowNodeTransformFnSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal("if"),
      path: z.array(z.string()).optional(),
      branches: z.record(z.string(), WorkflowNodeTransformFnSchema),
    }),
    z.object({
      type: z.literal("map"),
      path: z.array(z.string()).optional(),
      fn: WorkflowNodeTransformFnSchema,
    }),
    z.object({
      type: z.literal("with"),
      path: z.array(z.string()),
      fn: WorkflowNodeTransformFnSchema,
    }),
    z.object({
      type: z.literal("get"),
      path: z.array(z.string()).optional(),
    }),
    z.object({
      type: z.literal("object"),
      value: z.record(z.string(), WorkflowNodeTransformFnSchema),
    }),
    z.object({
      type: z.literal("taggedUnion"),
      tag: z.string(),
      value: z.record(z.string(), WorkflowNodeTransformFnSchema),
    }),
    z.object({
      type: z.literal("const"),
      value: z.unknown(),
    }),
  ])
);

// Stream Operators
export const WorkflowStreamOperatorSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal("map"), fn: WorkflowNodeTransformFnSchema }),
    z.object({ type: z.literal("filter"), fn: WorkflowNodeTransformFnSchema }),
    z.object({ type: z.literal("merge"), streams: z.array(z.string()) }),
    z.object({ type: z.literal("debounce"), ms: z.number() }),
    z.object({ type: z.literal("throttle"), ms: z.number() }),
    z.object({ type: z.literal("take"), count: z.number() }),
    z.object({ type: z.literal("skip"), count: z.number() }),
    z.object({
      type: z.literal("scan"),
      fn: WorkflowNodeTransformFnSchema,
      initialValue: z.unknown().optional(),
    }),
    z.object({ type: z.literal("distinct") }),
    z.object({ type: z.literal("distinctUntilChanged") }),
  ])
);

// Stream Source
export const WorkflowStreamSourceSchema = z.union([
  z.object({ type: z.literal("node"), nodeId: z.string() }),
  z.object({ type: z.literal("external"), sourceFn: z.string() }),
  z.object({ type: z.literal("merge"), nodeIds: z.array(z.string()) }),
]);

// Workflow Tools
export const WorkflowToolIntrinsicSchema = z.object({
  type: z.union([
    z.literal("requestIncreaseMaxRetries"),
    z.literal("logIncident"),
  ]),
});

export const WorkflowToolCustomSchema = z.object({
  type: z.literal("custom"),
  name: z.string(),
  overridedInput: z.unknown().optional(),
});

export const WorkflowToolSchema = z.union([
  WorkflowToolIntrinsicSchema,
  WorkflowToolCustomSchema,
]);

// Workflow Node Base
export const WorkflowNodeBaseSchema = z.object({
  inputType: WorkflowNodeMessageTypeSchema,
  outputType: WorkflowNodeMessageTypeSchema,
});

// Context System
export const WorkflowContextItemSchema = z.union([
  z.object({ type: z.literal("data"), value: z.unknown() }),
  z.object({ type: z.literal("nodeRef"), nodeId: z.string() }),
  z.object({ type: z.literal("workflowRef"), workflowId: z.string() }),
  z.object({
    type: z.literal("streamOperator"),
    operator: WorkflowStreamOperatorSchema,
  }),
]);

export const WorkflowContextSchema = z.object({
  items: z.record(z.string(), WorkflowContextItemSchema),
});

// LLM Reviewer
export const WorkflowNodeLLMReviewerSchema = z.object({
  systemPrompt: z.string().optional(),
  availableTools: z.array(WorkflowToolSchema).optional(),
});

// Workflow Nodes
export const WorkflowNodeLLMSchema = WorkflowNodeBaseSchema.extend({
  type: z.literal("llm"),
  maxRetries: z.number(),
  systemPrompt: z.string().optional(),
  availableTools: z.array(WorkflowToolSchema).optional(),
  reviewers: z.array(WorkflowNodeLLMReviewerSchema).optional(),
  requiresHumanReview: z.boolean().optional(),
});

export const WorkflowNodeTransformSchema = WorkflowNodeBaseSchema.extend({
  type: z.literal("transform"),
  fn: WorkflowNodeTransformFnSchema,
});

export const WorkflowNodeCallWorkflowSchema = WorkflowNodeBaseSchema.extend({
  type: z.literal("callWorkflow"),
  workflowRef: z.string(),
  inputMapping: WorkflowNodeTransformFnSchema.optional(),
  outputMapping: WorkflowNodeTransformFnSchema.optional(),
  requiresApproval: z.boolean().optional(),
});

export const WorkflowNodeStreamSchema = WorkflowNodeBaseSchema.extend({
  type: z.literal("stream"),
  source: WorkflowStreamSourceSchema,
  operators: z.array(WorkflowStreamOperatorSchema).optional(),
});

export const WorkflowNodeGeneratorSchema = WorkflowNodeBaseSchema.extend({
  type: z.literal("generator"),
  generatorFn: z.string(),
  contextAccess: z.array(z.string()).optional(),
});

// Forward declaration for WorkflowNode
export const WorkflowNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    WorkflowNodeGroupSchema,
    WorkflowNodeLLMSchema,
    WorkflowNodeTransformSchema,
    WorkflowNodeCallWorkflowSchema,
    WorkflowNodeStreamSchema,
    WorkflowNodeGeneratorSchema,
  ])
);

// Workflow Edge
export const WorkflowEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  previousNodeMessageOutputFieldName: z.string().optional(),
  messageInputFieldName: z.string().optional(),
  description: z.string(),
});

// Workflow Group Node
export const WorkflowNodeGroupSchema = WorkflowNodeBaseSchema.extend({
  type: z.literal("group"),
  label: z.string(),
  nodes: z.record(z.string(), WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
  entryPoint: z.string(),
  exitPoint: z.string(),
  context: WorkflowContextSchema.optional(),
});

// Workflow
export const WorkflowSchema = z.object({
  root: WorkflowNodeGroupSchema,
  typedefs: z.record(z.string(), WorkflowNodeMessageTypeSchema).optional(),
});

// Storage Types
export const SessionStatusSchema = z.enum([
  "running",
  "paused",
  "completed",
  "failed",
  "waiting_for_human_review",
  "waiting_for_budget_approval",
  "waiting_for_workflow_approval",
]);

export const BudgetPoolStatusSchema = z.enum([
  "active",
  "exhausted",
  "suspended",
]);

export const ApprovalTypeSchema = z.enum([
  "human_review",
  "budget_increase",
  "workflow_call",
]);

export const ApprovalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "expired",
]);

export const NodeExecutionStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
  "waiting_for_approval",
  "waiting_for_review",
]);

// Session
export const SessionSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  workflowSnapshot: WorkflowSchema,
  status: SessionStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Budget Pool
export const BudgetPoolSchema = z.object({
  id: z.string(),
  parentPoolId: z.string().optional(),
  totalBudget: z.number(),
  usedBudget: z.number(),
  remainingBudget: z.number(),
  status: BudgetPoolStatusSchema,
  createdAt: z.date(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Execution Context
export const ExecutionContextSchema = z.object({
  sessionId: z.string(),
  budgetPoolId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  startedAt: z.date().optional(),
});
