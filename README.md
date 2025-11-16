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
