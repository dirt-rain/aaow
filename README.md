# `aaow` - **A**I **A**gent **O**rchestration **W**orkflow

Complex LLM workflows with provider flexibility, hierarchical budget control, and visual monitoring.

## Overview

`aaow` is a TypeScript-based workflow orchestration system that lets you:

- 🎯 **Define complex workflows** as static graphs with conditional branching and parallel execution
- 💰 **Control costs** with hierarchical budget pools and real-time tracking
- 🔀 **Use Vercel AI SDK** - unified interface for multiple LLM providers
- 🔍 **Monitor everything** - web UI with real-time execution tracking and budget dashboards
- 🎛️ **Human-in-the-loop** - pause workflows for user input or budget approval

## Architecture

```text
┌─────────────────────────────────────────┐
│        Web UI (coming soon)             │
│   Workflow Builder + Monitoring         │
└──────────────┬──────────────────────────┘
               │ HTTP / SSE
┌──────────────▼──────────────────────────┐
│             aaow                        │
│      Local HTTP API Server              │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         @aaow/core                      │
│    Workflow Runtime Engine              │
│  • Graph execution                      │
│  • Budget pool management               │
│  • Session management                   │
│  • Vercel AI SDK integration            │
└─────────────────────────────────────────┘
```

## Workflow Programming Paradigms

`aaow` supports multiple programming paradigms by treating workflows, subgraphs, and nodes as reusable, composable components that can be used in different execution contexts.

### Core Concepts

**Nodes as Functions**: Every node (including subgraphs) acts like a function with typed inputs and outputs. Nodes execute automatically when their dependencies (previous nodes) complete, supporting fork/join patterns for parallel execution.

**Groups (Subgraphs)**: Groups encapsulate nodes and edges with designated entry and exit points, acting as composite nodes in larger workflows. They can be restarted for loop-like behavior and provide scope for context and budget management.

### Reusable Workflows

**Call Workflow Node**: Invoke subgraphs or external workflows as reusable components within your workflow graph. When a workflow call is made:
- Executes within the caller's budget initially
- If LLM nodes need more budget, they can request approval via tool calls (human-in-the-loop)
- Upon approval, continues execution in a new independent budget pool
- Can be called from multiple locations, promoting DRY principles

### Hierarchical Context System

Each group can define its own context that child groups inherit:

- **String-based Keys**: Contexts are identified by string keys (e.g., `"api-client"`, `"user-settings"`)
- **Context Inheritance**: Child groups can access contexts from parent and ancestor groups
- **Flexible Content**: Contexts can hold data, subgraph references, or stream operators
- **Scoped Access**: Nodes can reference context items to call them as functions, coroutines, or stream operators

### Execution Modes

Workflows and nodes support different execution patterns:

#### 1. Graph Execution (Default)
Standard workflow execution following edges between nodes. Nodes execute when all predecessor nodes complete (automatic fork/join synchronization).

#### 2. Stream Processing
Stream nodes consume and transform data reactively:
- Subscribe to outputs from other stream nodes
- Apply reactive operators (map, filter, merge, etc.)
- External data sources (APIs, WebSocket) can be integrated via custom stream source functions
- Lifecycle tied to workflow execution (starts/ends with workflow)

#### 3. Generator-based Workflows (Coroutines)
Workflow execution can be defined as generator functions:
- The generator represents a workflow run instance
- Values yielded by the generator act as a stream
- Can call nodes from the workflow graph and parent context as functions, coroutines, or stream operators
- Enables imperative-style workflow definitions with async iteration

### Programming Paradigm Support

This design enables multiple programming styles:

- **Structural/Procedural**: Sequential and parallel execution with groups and controlled flow
- **Object-Oriented**: Encapsulation via groups, context inheritance for shared state/behavior
- **Functional**: Compose workflows from reusable node functions with typed input/output
- **Reactive**: Stream-based data processing with operators and generator-based coroutines

## Packages

### `@aaow/core`

The workflow runtime engine. Executes workflow graphs, manages budget pools, integrates with Vercel AI SDK for LLM providers.

### `@aaow/types`

Shared TypeScript types and interfaces used across all packages.

### `@aaow/server`

Express app for the HTTP API server with REST endpoints and Server-Sent Events for real-time updates.

### `aaow`

Preconfigured HTTP API server with web UI for workflow monitoring and management.

## Project Status

🚧 **Early Development** - Core runtime and provider abstractions are being implemented.

- [x] Project structure and architecture
- [ ] @aaow/core runtime engine
- [ ] Vercel AI SDK integration
- [ ] HTTP API server
- [ ] Budget pool system
- [ ] Web UI
- [ ] Documentation
