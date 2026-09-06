import { z } from "zod";

export interface ToolExecutionContext {
  signal?: AbortSignal;
  metadata?: Readonly<Record<string, string>>;
  capabilities?: readonly string[];
}

export interface Tool<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: z.ZodType<TInput>;
  execute(input: TInput, context?: ToolExecutionContext): Promise<TOutput> | TOutput;
}

export class ToolInputValidationError extends Error {
  readonly toolName: string;
  readonly issues: z.ZodIssue[];

  constructor(toolName: string, issues: z.ZodIssue[]) {
    super(`Invalid input for tool "${toolName}".`);
    this.name = "ToolInputValidationError";
    this.toolName = toolName;
    this.issues = issues;
  }
}

export function validateToolInput<TInput>(
  tool: Tool<TInput, unknown>,
  input: unknown,
): TInput {
  const parsed = tool.inputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ToolInputValidationError(tool.name, parsed.error.issues);
  }
  return parsed.data;
}
