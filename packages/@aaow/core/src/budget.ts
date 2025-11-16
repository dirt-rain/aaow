import type { BudgetPool, StorageAdapter } from "@aaow/types";

/**
 * Budget Pool Manager
 *
 * Manages hierarchical budget pools for cost tracking and control
 */
export class BudgetPoolManager {
  constructor(private storage: StorageAdapter) {}

  /**
   * Create a new budget pool
   */
  async createPool(
    id: string,
    totalBudget: number,
    parentPoolId?: string,
    metadata?: Record<string, unknown>
  ): Promise<BudgetPool> {
    const pool: BudgetPool = {
      id,
      parentPoolId,
      totalBudget,
      usedBudget: 0,
      remainingBudget: totalBudget,
      status: "active",
      createdAt: new Date(),
      metadata,
    };

    await this.storage.createBudgetPool(pool);
    return pool;
  }

  /**
   * Check if budget is available
   */
  async checkBudget(poolId: string, amount: number): Promise<boolean> {
    const pool = await this.storage.getBudgetPool(poolId);
    if (!pool) {
      throw new Error(`Budget pool ${poolId} not found`);
    }

    if (pool.status !== "active") {
      return false;
    }

    return pool.remainingBudget >= amount;
  }

  /**
   * Consume budget from a pool
   */
  async consumeBudget(poolId: string, amount: number): Promise<void> {
    const pool = await this.storage.getBudgetPool(poolId);
    if (!pool) {
      throw new Error(`Budget pool ${poolId} not found`);
    }

    if (pool.status !== "active") {
      throw new Error(`Budget pool ${poolId} is not active`);
    }

    if (pool.remainingBudget < amount) {
      throw new Error(`Insufficient budget in pool ${poolId}`);
    }

    const usedBudget = pool.usedBudget + amount;
    const remainingBudget = pool.remainingBudget - amount;
    const status = remainingBudget <= 0 ? "exhausted" : "active";

    await this.storage.updateBudgetPool(poolId, {
      usedBudget,
      remainingBudget,
      status,
    });

    // Update parent pool if exists
    if (pool.parentPoolId) {
      await this.consumeBudget(pool.parentPoolId, amount);
    }
  }

  /**
   * Increase budget pool allocation
   */
  async increaseBudget(poolId: string, amount: number): Promise<void> {
    const pool = await this.storage.getBudgetPool(poolId);
    if (!pool) {
      throw new Error(`Budget pool ${poolId} not found`);
    }

    const totalBudget = pool.totalBudget + amount;
    const remainingBudget = pool.remainingBudget + amount;
    const status = remainingBudget > 0 ? "active" : pool.status;

    await this.storage.updateBudgetPool(poolId, {
      totalBudget,
      remainingBudget,
      status,
    });
  }

  /**
   * Get budget pool status
   */
  async getPool(poolId: string): Promise<BudgetPool | null> {
    return this.storage.getBudgetPool(poolId);
  }

  /**
   * Get child budget pools
   */
  async getChildPools(poolId: string): Promise<BudgetPool[]> {
    return this.storage.getChildBudgetPools(poolId);
  }

  /**
   * Suspend a budget pool
   */
  async suspendPool(poolId: string): Promise<void> {
    await this.storage.updateBudgetPool(poolId, { status: "suspended" });
  }

  /**
   * Reactivate a budget pool
   */
  async reactivatePool(poolId: string): Promise<void> {
    const pool = await this.storage.getBudgetPool(poolId);
    if (!pool) {
      throw new Error(`Budget pool ${poolId} not found`);
    }

    if (pool.remainingBudget > 0) {
      await this.storage.updateBudgetPool(poolId, { status: "active" });
    }
  }
}
