# @aaow/types

Shared TypeScript types and interfaces used across all `aaow` packages.

## Overview

This package provides core type definitions for:

- Workflow structures (nodes, edges, groups)
- Node types (LLM, Transform, Stream, Generator, CallWorkflow)
- Context system for hierarchical data sharing
- Stream processing and reactive operators
- Tool definitions compatible with Vercel AI SDK

## Usage

```typescript
import type { Workflow, WorkflowNode, WorkflowNodeLLM } from "@aaow/types";
```

## License

WTFPL
