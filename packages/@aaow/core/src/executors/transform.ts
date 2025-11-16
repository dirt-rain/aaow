/**
 * Transform node executor
 *
 * Executes data transformation functions on workflow data
 */

type TransformFn = any; // Recursive type, using any for flexibility

/**
 * Get value from object using path
 */
function getValueByPath(data: any, path: string[] = []): any {
  if (path.length === 0) {
    return data;
  }

  let current = data;
  for (const key of path) {
    if (current == null) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

/**
 * Set value in object using path
 */
function setValueByPath(data: any, path: string[], value: any): void {
  if (path.length === 0) {
    return;
  }

  let current = data;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }
  current[path[path.length - 1]] = value;
}

/**
 * Execute transform function
 */
export async function executeTransform(
  fn: TransformFn,
  data: unknown,
  basePath: string[] = []
): Promise<unknown> {
  switch (fn.type) {
    case "const":
      return fn.value;

    case "get": {
      const path = [...basePath, ...(fn.path || [])];
      return getValueByPath(data, path);
    }

    case "with": {
      const newBasePath = [...basePath, ...fn.path];
      return executeTransform(fn.fn, data, newBasePath);
    }

    case "if": {
      const path = [...basePath, ...(fn.path || [])];
      const value = getValueByPath(data, path);

      // Handle tagged union
      if (typeof value === "object" && value !== null && "tag" in value) {
        const tag = (value as any).tag;
        if (tag in fn.branches) {
          return executeTransform(fn.branches[tag], data, basePath);
        }
      }

      // Handle enum/string value
      const stringValue = String(value);
      if (stringValue in fn.branches) {
        return executeTransform(fn.branches[stringValue], data, basePath);
      }

      throw new Error(`No branch found for value: ${stringValue}`);
    }

    case "map": {
      const path = [...basePath, ...(fn.path || [])];
      const array = getValueByPath(data, path);

      if (!Array.isArray(array)) {
        throw new Error(`Expected array at path ${path.join(".")}, got ${typeof array}`);
      }

      return Promise.all(
        array.map((item) =>
          executeTransform(
            fn.fn,
            typeof data === "object" && data !== null
              ? { ...(data as any), item }
              : { item },
            basePath
          )
        )
      );
    }

    case "object": {
      const result: Record<string, unknown> = {};

      for (const [key, valueFn] of Object.entries(fn.value)) {
        result[key] = await executeTransform(valueFn, data, basePath);
      }

      return result;
    }

    case "taggedUnion": {
      const result: Record<string, unknown> = {
        tag: fn.tag,
      };

      for (const [key, valueFn] of Object.entries(fn.value)) {
        result[key] = await executeTransform(valueFn, data, basePath);
      }

      return result;
    }

    default:
      throw new Error(`Unknown transform function type: ${(fn as any).type}`);
  }
}
