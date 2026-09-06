import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  DecisionTaskMismatchError,
  Orchestrator,
} from "../../src/core/orchestrator";
import { Tool } from "../../src/core/tool";
import { Task } from "../../src/core/types";

const task: Task = {
  id: "task-1",
  goal: "echo hello",
  createdAt: "2026-09-06T08:00:00.000Z",
  status: "created",
  requiresApproval: false,
  version: 0,
};

const echoTool: Tool<{ message: string }, { echoed: string }> = {
  name: "echo",
  description: "Echo text",
  inputSchema: z.object({ message: z.string() }),
  execute: (input) => ({ echoed: input.message }),
};

const registry = {
  get: (name: string) => (name === "echo" ? echoTool : undefined),
};

const now = vi
  .fn()
  .mockReturnValueOnce("2026-09-06T08:00:00.000Z")
  .mockReturnValueOnce("2026-09-06T08:00:01.000Z");

describe("Orchestrator.handleDecision", () => {
  it("rejects an invalid runtime Decision without invoking a Tool", async () => {
    const execute = vi.fn();
    const invalidRegistry = {
      get: () => ({ ...echoTool, execute }),
    };
    const orchestrator = new Orchestrator(invalidRegistry);
    const result = await orchestrator.handleDecision(
      task,
      { kind: "tool_request", toolName: "echo" },
      { planStepId: "step-1", executionId: "execution-0", now },
    );

    expect(result.kind).toBe("rejected");
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns a final Result without creating an Execution", async () => {
    const orchestrator = new Orchestrator(registry);
    const result = await orchestrator.handleDecision(
      task,
      {
        kind: "final",
        result: {
          taskId: task.id,
          status: "success",
          summary: "Already complete",
          producedAt: "2026-09-06T08:00:00.000Z",
        },
      },
      { planStepId: "step-1", executionId: "execution-1", now },
    );

    expect(result).toEqual({
      kind: "result",
      result: {
        taskId: "task-1",
        status: "success",
        summary: "Already complete",
        producedAt: "2026-09-06T08:00:00.000Z",
      },
    });
  });

  it("resolves the Tool and wraps a ToolRequest as an Execution", async () => {
    const orchestrator = new Orchestrator(registry);
    const result = await orchestrator.handleDecision(
      task,
      { kind: "tool_request", toolName: "echo", input: { message: "hello" } },
      {
        planStepId: "step-1",
        executionId: "execution-1",
        now: vi
          .fn()
          .mockReturnValueOnce("2026-09-06T08:00:00.000Z")
          .mockReturnValueOnce("2026-09-06T08:00:01.000Z"),
      },
    );

    expect(result.kind).toBe("execution");
    if (result.kind !== "execution") throw new Error("expected execution");
    expect(result.execution.status).toBe("succeeded");
    expect(result.execution.output).toEqual({ echoed: "hello" });
  });

  it("performs registry lookup before input validation and execution", async () => {
    const order: string[] = [];
    const orderedTool: Tool<{ message: string }, { echoed: string }> = {
      ...echoTool,
      inputSchema: z.object({
        message: z.string().transform((value) => {
          order.push("validation");
          return value;
        }),
      }),
      execute: (input) => {
        order.push("execute");
        return { echoed: input.message };
      },
    };
    const orderedRegistry = {
      get: (name: string) => {
        order.push("lookup");
        return name === "echo" ? orderedTool : undefined;
      },
    };

    await new Orchestrator(orderedRegistry).handleDecision(
      task,
      { kind: "tool_request", toolName: "echo", input: { message: "hello" } },
      {
        planStepId: "step-1",
        executionId: "execution-order",
        now: vi
          .fn()
          .mockReturnValueOnce("2026-09-06T08:00:00.000Z")
          .mockReturnValueOnce("2026-09-06T08:00:01.000Z"),
      },
    );

    expect(order).toEqual(["lookup", "validation", "execute"]);
  });

  it("turns an unknown Tool into a failed Execution", async () => {
    const orchestrator = new Orchestrator(registry);
    const result = await orchestrator.handleDecision(
      task,
      { kind: "tool_request", toolName: "missing", input: {} },
      {
        planStepId: "step-1",
        executionId: "execution-2",
        now: vi
          .fn()
          .mockReturnValueOnce("2026-09-06T08:00:00.000Z")
          .mockReturnValueOnce("2026-09-06T08:00:01.000Z"),
      },
    );

    expect(result.kind).toBe("execution");
    if (result.kind !== "execution") throw new Error("expected execution");
    expect(result.execution.status).toBe("failed");
    expect(result.execution.error).toContain('Tool "missing" was not found');
  });

  it("rejects a final Result belonging to another Task", async () => {
    const orchestrator = new Orchestrator(registry);
    await expect(
      orchestrator.handleDecision(
        task,
        {
          kind: "final",
          result: {
            taskId: "other-task",
            status: "success",
            summary: "Wrong task",
            producedAt: "2026-09-06T08:00:00.000Z",
          },
        },
        { planStepId: "step-1", executionId: "execution-3", now },
      ),
    ).rejects.toBeInstanceOf(DecisionTaskMismatchError);
  });
});
