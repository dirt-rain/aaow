import { describe, it, expect } from "vitest";
import { executeTransform } from "../src/executors/transform";

describe("Transform Executor", () => {
  it("should execute const transform", async () => {
    const result = await executeTransform(
      { type: "const", value: "hello" },
      {}
    );
    expect(result).toBe("hello");
  });

  it("should execute get transform", async () => {
    const result = await executeTransform(
      { type: "get", path: ["user", "name"] },
      { user: { name: "Alice" } }
    );
    expect(result).toBe("Alice");
  });

  it("should execute object transform", async () => {
    const result = await executeTransform(
      {
        type: "object",
        value: {
          name: { type: "get", path: ["user", "name"] },
          age: { type: "const", value: 30 },
        },
      },
      { user: { name: "Bob" } }
    );
    expect(result).toEqual({ name: "Bob", age: 30 });
  });

  it("should execute if transform", async () => {
    const result = await executeTransform(
      {
        type: "if",
        path: ["status"],
        branches: {
          success: { type: "const", value: "OK" },
          error: { type: "const", value: "FAIL" },
        },
      },
      { status: "success" }
    );
    expect(result).toBe("OK");
  });

  it("should execute map transform", async () => {
    const result = await executeTransform(
      {
        type: "map",
        path: ["items"],
        fn: { type: "get", path: ["item", "value"] },
      },
      {
        items: [{ value: 1 }, { value: 2 }, { value: 3 }],
      }
    );
    expect(result).toEqual([1, 2, 3]);
  });

  it("should execute with transform", async () => {
    const result = await executeTransform(
      {
        type: "with",
        path: ["user"],
        fn: { type: "get", path: ["name"] },
      },
      { user: { name: "Charlie" } }
    );
    expect(result).toBe("Charlie");
  });

  it("should execute taggedUnion transform", async () => {
    const result = await executeTransform(
      {
        type: "taggedUnion",
        tag: "user",
        value: {
          id: { type: "const", value: 123 },
          name: { type: "get", path: ["name"] },
        },
      },
      { name: "David" }
    );
    expect(result).toEqual({
      tag: "user",
      id: 123,
      name: "David",
    });
  });
});
