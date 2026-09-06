import { Decision, isDecisionForTask } from "./decision";
import { Execution, ExecutionId, Result, Task, TaskId } from "./types";
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

export interface ToolRegistry {
  get(name: string): Tool<unknown, unknown> | undefined;
}

export class MapToolRegistry implements ToolRegistry {
  constructor(private readonly tools: ReadonlyMap<string, Tool<unknown, unknown>>) {}

  get(name: string): Tool<unknown, unknown> | undefined {
    return this.tools.get(name);
  }
}

export interface HandleDecisionOptions {
  readonly planStepId: string;
  readonly executionId: ExecutionId;
  readonly now: () => string;
  readonly context?: ToolExecutionContext;
}

export type OrchestratorOutcome =
  | { readonly kind: "execution"; readonly execution: Execution }
  | { readonly kind: "result"; readonly result: Result };

export class DecisionTaskMismatchError extends Error {
  readonly taskId: TaskId;
  readonly decisionTaskId: TaskId;

  constructor(taskId: TaskId, decisionTaskId: TaskId) {
    super(
      `Decision task mismatch: orchestrator received task "${taskId}" ` +
        `but decision belongs to task "${decisionTaskId}".`,
    );
    this.name = "DecisionTaskMismatchError";
    this.taskId = taskId;
    this.decisionTaskId = decisionTaskId;
  }
}

/**
 * The Decision receiver and execution boundary. It resolves Tools, delegates
 * raw invocation to invokeTool(), and never asks an Agent to execute anything.
 */
export class Orchestrator {
  constructor(private readonly tools: ToolRegistry) {}

  async handleDecision(
    task: Readonly<Task>,
    decision: Decision,
    options: HandleDecisionOptions,
  ): Promise<OrchestratorOutcome> {
    if (decision.kind === "final") {
      if (!isDecisionForTask(decision, task.id)) {
        throw new DecisionTaskMismatchError(task.id, decision.result.taskId);
      }
      return { kind: "result", result: decision.result };
    }

    const tool = this.tools.get(decision.toolName);
    if (!tool) {
      return {
        kind: "execution",
        execution: {
          id: options.executionId,
          taskId: task.id,
          planStepId: options.planStepId,
          toolName: decision.toolName,
          input: decision.input,
          status: "failed",
          startedAt: options.now(),
          finishedAt: options.now(),
          error: `Tool "${decision.toolName}" was not found in the registry.`,
        },
      };
    }

    const execution = await invokeTool({
      taskId: task.id,
      planStepId: options.planStepId,
      executionId: options.executionId,
      tool,
      input: decision.input,
      now: options.now,
      context: options.context,
    });
    return { kind: "execution", execution };
  }
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
