-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "metadata" TEXT
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT,
    "workflowSnapshot" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "metadata" TEXT,
    CONSTRAINT "sessions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "execution_states" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "budgetPoolId" TEXT,
    "currentNodeId" TEXT,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "metadata" TEXT,
    CONSTRAINT "execution_states_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "node_execution_states" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input" TEXT,
    "output" TEXT,
    "error" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "pendingApprovalId" TEXT,
    "metadata" TEXT,
    CONSTRAINT "node_execution_states_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "llm_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,
    "text" TEXT,
    "toolCalls" TEXT,
    "usage_promptTokens" INTEGER,
    "usage_completionTokens" INTEGER,
    "usage_totalTokens" INTEGER,
    "error" TEXT,
    "metadata" TEXT,
    CONSTRAINT "llm_executions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "budget_pools" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentPoolId" TEXT,
    "totalBudget" REAL NOT NULL,
    "usedBudget" REAL NOT NULL,
    "remainingBudget" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    CONSTRAINT "budget_pools_parentPoolId_fkey" FOREIGN KEY ("parentPoolId") REFERENCES "budget_pools" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tool_call_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "executionId" TEXT NOT NULL,
    "toolCallId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "args" TEXT NOT NULL,
    "result" TEXT,
    "error" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    CONSTRAINT "tool_call_logs_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "llm_executions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "resolutionNotes" TEXT,
    CONSTRAINT "approval_requests_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stream_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "streamId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "workflows_name_idx" ON "workflows"("name");

-- CreateIndex
CREATE INDEX "workflows_version_idx" ON "workflows"("version");

-- CreateIndex
CREATE INDEX "sessions_workflowId_idx" ON "sessions"("workflowId");

-- CreateIndex
CREATE INDEX "sessions_status_idx" ON "sessions"("status");

-- CreateIndex
CREATE INDEX "sessions_createdAt_idx" ON "sessions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "execution_states_sessionId_key" ON "execution_states"("sessionId");

-- CreateIndex
CREATE INDEX "node_execution_states_sessionId_idx" ON "node_execution_states"("sessionId");

-- CreateIndex
CREATE INDEX "node_execution_states_status_idx" ON "node_execution_states"("status");

-- CreateIndex
CREATE UNIQUE INDEX "node_execution_states_sessionId_nodeId_key" ON "node_execution_states"("sessionId", "nodeId");

-- CreateIndex
CREATE INDEX "llm_executions_sessionId_idx" ON "llm_executions"("sessionId");

-- CreateIndex
CREATE INDEX "llm_executions_nodeId_idx" ON "llm_executions"("nodeId");

-- CreateIndex
CREATE INDEX "llm_executions_timestamp_idx" ON "llm_executions"("timestamp");

-- CreateIndex
CREATE INDEX "budget_pools_parentPoolId_idx" ON "budget_pools"("parentPoolId");

-- CreateIndex
CREATE INDEX "budget_pools_status_idx" ON "budget_pools"("status");

-- CreateIndex
CREATE INDEX "tool_call_logs_executionId_idx" ON "tool_call_logs"("executionId");

-- CreateIndex
CREATE INDEX "tool_call_logs_toolName_idx" ON "tool_call_logs"("toolName");

-- CreateIndex
CREATE INDEX "tool_call_logs_timestamp_idx" ON "tool_call_logs"("timestamp");

-- CreateIndex
CREATE INDEX "approval_requests_sessionId_idx" ON "approval_requests"("sessionId");

-- CreateIndex
CREATE INDEX "approval_requests_status_idx" ON "approval_requests"("status");

-- CreateIndex
CREATE INDEX "approval_requests_type_idx" ON "approval_requests"("type");

-- CreateIndex
CREATE INDEX "approval_requests_createdAt_idx" ON "approval_requests"("createdAt");

-- CreateIndex
CREATE INDEX "stream_events_streamId_idx" ON "stream_events"("streamId");

-- CreateIndex
CREATE INDEX "stream_events_timestamp_idx" ON "stream_events"("timestamp");
