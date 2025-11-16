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

`aaow` supports multiple programming paradigms for workflow composition, allowing you to leverage structural/procedural, object-oriented/functional, and reactive programming patterns.

### Groups (Subgraphs as Nodes)

- **Subgraph Nodes**: Groups encapsulate nodes and edges with dedicated `start` and `end` nodes
- **Controlled Flow**: Arbitrary jumps (goto/jump) are restricted to maintain structure
- **Group Restart**: Restart entire groups for loop-like behavior (similar to `while`/`loop` + `continue`)

### Call Workflow

Call subgroups or external workflows as reusable components:

- **Budget-aware Execution**: Initially runs within the caller's budget
- **Approval Flow**: Requests user approval for workflow calls
- **Budget Restoration**: Upon approval, restores consumed budget and executes in a new budget group

### Hierarchical Context System

- **Per-Group Context**: Each group can define its own context (data or subgraph/workflow references)
- **Context Inheritance**: Child groups can access parent (and ancestor) contexts
- **Type-based Resolution**: Similar to React's Context API - contexts are differentiated by type

### Functional and Reactive Support

Workflows and subgraphs can operate in multiple modes:

- **Function Mode**: Simple input → output transformation (pure functions)
- **Stream Mode**: React to data sources or other stream nodes
- **Coroutine Support**: Generator-based workflows that can be used as streams

This design enables:
- **Structural/Procedural**: Sequential execution with groups and controlled flow
- **Object-Oriented**: Encapsulation via groups with context inheritance
- **Functional**: Pure transformation workflows
- **Reactive**: Stream-based data processing with coroutines

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
