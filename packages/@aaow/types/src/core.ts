export interface Workflow {
  root: WorkflowNodeGroup;
  // customTools?: Partial<Record<string, WorkflowCustomTool>>[]; // TODO: implement later
  typedefs?: Record<string, WorkflowNodeMessageType>;
}

export type WorkflowNodeMessageType =
  | { type: "string" }
  | { type: "enum"; value: string[] }
  | { type: "array"; of: WorkflowNodeMessageType }
  | { type: "optional"; of: WorkflowNodeMessageType }
  | {
      type: "object";
      value: Partial<
        Record<string, { description: string; type: WorkflowNodeMessageType }>
      >;
    }
  | {
      type: "taggedUnion";
      value: Partial<
        Record<string, { description: string; type: WorkflowNodeMessageType }>
      >;
    }
  | { type: "ref"; ref: string };

export interface WorkflowNodeBase {
  inputType: WorkflowNodeMessageType;
  outputType: WorkflowNodeMessageType;
}

// Group node executions hierarchically, can be stopped, like try/catch with abort/restart
export interface WorkflowNodeGroup extends WorkflowNodeBase {
  type: "group";
  label: string;
  nodes: Partial<Record<string, WorkflowNode>>;
  edges: WorkflowEdge[];
  entryPoint: string;
  exitPoint: string;
}

export interface WorkflowNodeLLM extends WorkflowNodeBase {
  type: "llm";
  maxRetries: number; // can be increased by tool calling: "increaseMaxRetries"
  systemPrompt?: string;
  availableTools?: WorkflowTool[];
  reviewers?: WorkflowNodeLLMReviewer[];
  requiresHumanReview?: boolean;
}

export interface WorkflowNodeLLMReviewer {
  systemPrompt?: string;
  availableTools?: WorkflowTool[];
}

export interface WorkflowToolIntrinsic {
  type: "requestIncreaseMaxRetries" | "logIncident";
}

export interface WorkflowToolCustom {
  type: "custom";
  name: string;
  overridedInput?: unknown;
}

export type WorkflowTool = WorkflowToolIntrinsic | WorkflowToolCustom;

export interface WorkflowNodeTransform extends WorkflowNodeBase {
  type: "transform";
  fn: WorkflowNodeTransformFn;
}

type WorkflowNodeTransformFn =
  | WorkflowNodeTransformFnIf
  | WorkflowNodeTransformFnMap
  | WorkflowNodeTransformFnWith
  | WorkflowNodeTransformFnGet
  | WorkflowNodeTransformFnObject
  | WorkflowNodeTransformFnTaggedUnion
  | WorkflowNodeTransformFnConst;

// conditional branching depending on a enum value or tag of a tagged union
interface WorkflowNodeTransformFnIf {
  type: "if";
  path?: string[]; // "value" -> [], { foo: { bar: "value" } } -> ["foo", "bar"]
  branches: Record<string, WorkflowNodeTransformFn>;
}

// map over an array
interface WorkflowNodeTransformFnMap {
  type: "map";
  path?: string[]; // ["value"] -> [], { foo: { bar: ["value"] } } -> ["foo", "bar"]
  fn: WorkflowNodeTransformFn; // 'with' is applied to the item of the array. See below
}

// prevent deep paths, by automatically append path segments when evaluating the fn
interface WorkflowNodeTransformFnWith {
  type: "with";
  path: string[]; // for example: path = ["foo", "bar"], data = { foo: { bar: { baz: "value" } } }
  fn: WorkflowNodeTransformFn; // now you can access baz by path = ["baz"] instead of path = ["foo", "bar", "baz"]
}

interface WorkflowNodeTransformFnGet {
  type: "get";
  path?: string[]; // "path" = ["foo"], data = { foo: { bar: "value" } } -> { bar: "value" }
}

interface WorkflowNodeTransformFnObject {
  type: "object";
  value: Partial<Record<string, WorkflowNodeTransformFn>>;
}

interface WorkflowNodeTransformFnTaggedUnion {
  type: "taggedUnion";
  tag: string;
  value: Partial<Record<string, WorkflowNodeTransformFn>>;
}

interface WorkflowNodeTransformFnConst {
  type: "const";
  value: unknown;
}

export type WorkflowNode = WorkflowNodeGroup | WorkflowNodeLLM;

export interface WorkflowEdge {
  from: string;
  to: string;
  previousNodeMessageOutputFieldName?: string;
  messageInputFieldName?: string;
  description: string;
}
