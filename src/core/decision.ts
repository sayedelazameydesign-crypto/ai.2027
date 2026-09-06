import { z } from "zod";

import { Result, TaskId } from "./types";

export interface ToolRequest {
  readonly kind: "tool_request";
  readonly toolName: string;
  readonly input: unknown;
}

export interface FinalDecision {
  readonly kind: "final";
  readonly result: Result;
}

export type Decision = ToolRequest | FinalDecision;

const resultSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(["success", "failure"]),
  summary: z.string(),
  producedAt: z.string().datetime({ offset: true }),
});

export const toolRequestSchema = z.object({
  kind: z.literal("tool_request"),
  toolName: z.string().min(1),
  input: z.unknown(),
});

export const finalDecisionSchema = z.object({
  kind: z.literal("final"),
  result: resultSchema,
});

export const decisionSchema = z.discriminatedUnion("kind", [
  toolRequestSchema,
  finalDecisionSchema,
]);

export class DecisionValidationError extends Error {
  readonly issues: z.ZodIssue[];

  constructor(issues: z.ZodIssue[]) {
    super("Invalid Agent decision.");
    this.name = "DecisionValidationError";
    this.issues = issues;
  }
}

export function validateDecision(input: unknown): Decision {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) {
    throw new DecisionValidationError(parsed.error.issues);
  }
  return parsed.data as Decision;
}

export function isDecisionForTask(decision: FinalDecision, taskId: TaskId): boolean {
  return decision.result.taskId === taskId;
}
