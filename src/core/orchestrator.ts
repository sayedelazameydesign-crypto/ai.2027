import { Execution, ExecutionId, TaskId } from "./types";
import { Tool, ToolExecutionContext, validateToolInput } from "./tool";

export interface InvokeToolOptions<TInput> {
  readonly taskId: TaskId;
  readonly planStepId: string;
  readonly executionId: ExecutionId;
  readonly tool: Tool<TInput, unknown>;
  readonly input: unknown;
  readonly now: () => string;
  readonly context?: ToolExecutionContext;
}

/**
 * Owns execution bookkeeping while keeping Task/Execution out of Tool.
 * The adapter returns one terminal Execution record for this invocation.
 */
export async function invokeTool<TInput>(
  options: InvokeToolOptions<TInput>,
): Promise<Execution> {
  const startedAt = options.now();
  const base = {
    id: options.executionId,
    taskId: options.taskId,
    planStepId: options.planStepId,
    toolName: options.tool.name,
    input: options.input,
    startedAt,
  };

  try {
    const validatedInput = validateToolInput(options.tool, options.input);
    const output = await options.tool.execute(validatedInput, options.context);
    return {
      ...base,
      input: validatedInput,
      output,
      status: "succeeded",
      finishedAt: options.now(),
    };
  } catch (error) {
    return {
      ...base,
      status: "failed",
      finishedAt: options.now(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
