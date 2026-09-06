import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  Tool,
  ToolInputValidationError,
  validateToolInput,
} from "../../src/core/tool";
import { invokeTool } from "../../src/core/orchestrator";

const echoTool: Tool<{ message: string }, { echoed: string }> = {
  name: "echo",
  description: "Echo a message.",
  inputSchema: z.object({ message: z.string().min(1) }),
  execute: (input) => ({ echoed: input.message }),
};

describe("Tool contract", () => {
  it("validates dynamic input at runtime", () => {
    expect(validateToolInput(echoTool, { message: "hello" })).toEqual({
      message: "hello",
    });
    expect(() => validateToolInput(echoTool, { message: 42 })).toThrow(
      ToolInputValidationError,
    );
  });

  it("exposes capability metadata without domain dependencies", () => {
    expect(echoTool.name).toBe("echo");
    expect(echoTool.description).toBe("Echo a message.");
    expect(echoTool).not.toHaveProperty("task");
    expect(echoTool).not.toHaveProperty("execution");
  });

  it("forwards the narrow technical context to execute", async () => {
    const execute = vi.fn().mockResolvedValue("ok");
    const tool: Tool<{ value: string }, string> = {
      name: "context-test",
      description: "Tests context forwarding.",
      inputSchema: z.object({ value: z.string() }),
      execute,
    };
    const context = { metadata: { source: "test" }, capabilities: ["read"] };

    await invokeTool({
      taskId: "task-1",
      planStepId: "step-1",
      executionId: "execution-1",
      tool,
      input: { value: "x" },
      context,
      now: vi
        .fn()
        .mockReturnValueOnce("2026-09-06T08:00:00.000Z")
        .mockReturnValueOnce("2026-09-06T08:00:01.000Z"),
    });

    expect(execute).toHaveBeenCalledWith({ value: "x" }, context);
  });
});

describe("Orchestrator Tool adapter", () => {
  it("wraps a successful Tool call as a succeeded Execution", async () => {
    const execution = await invokeTool({
      taskId: "task-1",
      planStepId: "step-1",
      executionId: "execution-1",
      tool: echoTool,
      input: { message: "hello" },
      now: vi
        .fn()
        .mockReturnValueOnce("2026-09-06T08:00:00.000Z")
        .mockReturnValueOnce("2026-09-06T08:00:01.000Z"),
    });

    expect(execution).toEqual({
      id: "execution-1",
      taskId: "task-1",
      planStepId: "step-1",
      toolName: "echo",
      input: { message: "hello" },
      output: { echoed: "hello" },
      status: "succeeded",
      startedAt: "2026-09-06T08:00:00.000Z",
      finishedAt: "2026-09-06T08:00:01.000Z",
    });
  });

  it("does not invoke the Tool when input validation fails", async () => {
    const execute = vi.fn();
    const tool: Tool<{ count: number }, unknown> = {
      name: "count",
      description: "Accepts a count.",
      inputSchema: z.object({ count: z.number().int().nonnegative() }),
      execute,
    };

    const execution = await invokeTool({
      taskId: "task-1",
      planStepId: "step-1",
      executionId: "execution-2",
      tool,
      input: { count: "not-a-number" },
      now: vi
        .fn()
        .mockReturnValueOnce("2026-09-06T08:00:00.000Z")
        .mockReturnValueOnce("2026-09-06T08:00:01.000Z"),
    });

    expect(execute).not.toHaveBeenCalled();
    expect(execution.status).toBe("failed");
    expect(execution.error).toBe('Invalid input for tool "count".');
  });

  it("records Tool failures without leaking lifecycle responsibility into Tool", async () => {
    const tool: Tool<{ value: string }, never> = {
      name: "fails",
      description: "Always fails.",
      inputSchema: z.object({ value: z.string() }),
      execute: () => {
        throw new Error("tool exploded");
      },
    };

    const execution = await invokeTool({
      taskId: "task-1",
      planStepId: "step-1",
      executionId: "execution-3",
      tool,
      input: { value: "x" },
      now: vi
        .fn()
        .mockReturnValueOnce("2026-09-06T08:00:00.000Z")
        .mockReturnValueOnce("2026-09-06T08:00:01.000Z"),
    });

    expect(execution.status).toBe("failed");
    expect(execution.error).toBe("tool exploded");
  });
});
