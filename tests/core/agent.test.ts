import { describe, expect, it } from "vitest";

import { Agent } from "../../src/core/agent";
import {
  DecisionValidationError,
  validateDecision,
} from "../../src/core/decision";

const finalResult = {
  taskId: "task-1",
  status: "success" as const,
  summary: "Finished",
  producedAt: "2026-09-06T08:00:00.000Z",
};

describe("Decision contract", () => {
  it("accepts a tool request with opaque input", () => {
    expect(
      validateDecision({
        kind: "tool_request",
        toolName: "echo",
        input: { message: "hello" },
      }),
    ).toEqual({
      kind: "tool_request",
      toolName: "echo",
      input: { message: "hello" },
    });
  });

  it("accepts a final decision with a Result", () => {
    expect(validateDecision({ kind: "final", result: finalResult })).toEqual({
      kind: "final",
      result: finalResult,
    });
  });

  it("rejects unknown decision kinds and malformed final results", () => {
    expect(() => validateDecision({ kind: "approval" })).toThrow(
      DecisionValidationError,
    );
    expect(() =>
      validateDecision({ kind: "final", result: { taskId: "task-1" } }),
    ).toThrow(DecisionValidationError);
  });

  it("requires a non-empty tool name while leaving input opaque", () => {
    expect(() =>
      validateDecision({ kind: "tool_request", toolName: "", input: null }),
    ).toThrow(DecisionValidationError);
    expect(
      validateDecision({ kind: "tool_request", toolName: "echo", input: null }),
    ).toEqual({ kind: "tool_request", toolName: "echo", input: null });
  });
});

describe("Agent boundary", () => {
  it("allows an Agent to produce a Decision without an execution API", async () => {
    const agent: Agent = {
      name: "deterministic-test-agent",
      decide: ({ task }) => ({
        kind: "final",
        result: {
          taskId: task.id,
          status: "success",
          summary: "No action required",
          producedAt: "2026-09-06T08:00:00.000Z",
        },
      }),
    };

    const decision = await agent.decide({
      task: {
        id: "task-1",
        goal: "test",
        createdAt: "2026-09-06T07:59:00.000Z",
        status: "created",
        requiresApproval: false,
        version: 0,
      },
      availableTools: [{ name: "echo", description: "Echo text" }],
    });

    expect(decision.kind).toBe("final");
    expect(agent).not.toHaveProperty("execute");
    expect(agent).not.toHaveProperty("invokeTool");
  });
});
