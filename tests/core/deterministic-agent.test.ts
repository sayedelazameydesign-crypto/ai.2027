import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AgentContext } from "../../src/core/agent";
import { DeterministicAgent } from "../../src/core/deterministic-agent";
import { invokeTool } from "../../src/core/orchestrator";
import { Tool } from "../../src/core/tool";
import { Task } from "../../src/core/types";

function makeTask(goal: string): Task {
  return {
    id: "task-1",
    goal,
    createdAt: "2026-09-06T08:00:00.000Z",
    status: "created",
    requiresApproval: false,
    version: 0,
  };
}

function contextFor(task: Task): AgentContext {
  return {
    task,
    availableTools: [{ name: "echo", description: "Echo text" }],
  };
}

describe("DeterministicAgent", () => {
  it("produces a ToolRequest from a matching Task", () => {
    const agent = new DeterministicAgent({
      name: "echo-agent",
      matches: (task) => task.goal.startsWith("echo:"),
      toolName: "echo",
      createInput: (task) => ({ message: task.goal.slice(6) }),
      now: () => "2026-09-06T08:01:00.000Z",
    });

    expect(agent.decide(contextFor(makeTask("echo: hello")))).toEqual({
      kind: "tool_request",
      toolName: "echo",
      input: { message: "hello" },
    });
  });

  it("produces a final failure Result when no rule matches", () => {
    const agent = new DeterministicAgent({
      name: "echo-agent",
      matches: () => false,
      toolName: "echo",
      createInput: () => ({ message: "unused" }),
      now: () => "2026-09-06T08:01:00.000Z",
    });

    expect(agent.decide(contextFor(makeTask("unknown")))).toEqual({
      kind: "final",
      result: {
        taskId: "task-1",
        status: "failure",
        summary: "No deterministic rule matched the task.",
        producedAt: "2026-09-06T08:01:00.000Z",
      },
    });
  });

  it("reads the Task without mutating it or invoking a Tool", () => {
    const task = makeTask("echo: hello");
    const createInput = vi.fn((currentTask: Readonly<Task>) => ({
      message: currentTask.goal.slice(6),
    }));
    const agent = new DeterministicAgent({
      name: "echo-agent",
      matches: () => true,
      toolName: "echo",
      createInput,
      now: () => "2026-09-06T08:01:00.000Z",
    });

    const decision = agent.decide(contextFor(task));

    expect(decision.kind).toBe("tool_request");
    expect(createInput).toHaveBeenCalledWith(task);
    expect(task.status).toBe("created");
    expect(task.version).toBe(0);
    expect(agent).not.toHaveProperty("execute");
    expect(agent).not.toHaveProperty("invokeTool");
  });
});

describe("DeterministicAgent to Orchestrator to Tool", () => {
  it("completes the decision-to-execution path without Agent-side execution", async () => {
    const execute = vi.fn((input: { message: string }) => ({
      echoed: input.message,
    }));
    const tool: Tool<{ message: string }, { echoed: string }> = {
      name: "echo",
      description: "Echo text",
      inputSchema: z.object({ message: z.string() }),
      execute,
    };
    const agent = new DeterministicAgent({
      name: "echo-agent",
      matches: (task) => task.goal.startsWith("echo:"),
      toolName: "echo",
      createInput: (task) => ({ message: task.goal.slice(6) }),
      now: () => "2026-09-06T08:01:00.000Z",
    });

    const decision = agent.decide(contextFor(makeTask("echo: hello")));
    expect(decision.kind).toBe("tool_request");
    if (decision.kind !== "tool_request") throw new Error("expected ToolRequest");

    const execution = await invokeTool({
      taskId: "task-1",
      planStepId: "step-1",
      executionId: "execution-1",
      tool,
      input: decision.input,
      now: vi
        .fn()
        .mockReturnValueOnce("2026-09-06T08:01:00.000Z")
        .mockReturnValueOnce("2026-09-06T08:01:01.000Z"),
    });

    expect(execute).toHaveBeenCalledOnce();
    expect(execution.status).toBe("succeeded");
    expect(execution.output).toEqual({ echoed: "hello" });
  });
});
