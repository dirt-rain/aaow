/**
 * SQLite Storage Adapter for aaow
 *
 * Provides persistent storage for workflow executions, sessions,
 * LLM results, budget tracking, and human-in-the-loop approvals.
 */

export { SQLiteStorageAdapter } from "./adapter";
export type { StorageAdapter, StorageAdapterFactory } from "@aaow/types";
