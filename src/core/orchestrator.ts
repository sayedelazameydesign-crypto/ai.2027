import {
  Decision,
  DecisionValidationError,
  isDecisionForTask,
  validateDecision,
} from "./decision";
import { invokeTool } from "./orchestrator.internal";
import { Execution, ExecutionId, Result, Task, TaskId } from "./types";
import { Tool, ToolExecutionContext } from "./tool";

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
  | { readonly kind: "result"; readonly result: Result }
  | { readonly kind: "rejected"; readonly error: DecisionValidationError };

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
 * The sole public Decision receiver and execution boundary. It validates the
 * untrusted input before interpreting it, resolves Tools, and delegates raw
 * invocation to an internal helper that is not part of this public contract.
 */
export class Orchestrator {
  constructor(private readonly tools: ToolRegistry) {}

  async handleDecision(
    task: Readonly<Task>,
    input: unknown,
    options: HandleDecisionOptions,
  ): Promise<OrchestratorOutcome> {
    let decision: Decision;
    try {
      decision = validateDecision(input);
    } catch (error) {
      if (error instanceof DecisionValidationError) {
        return { kind: "rejected", error };
      }
      throw error;
    }

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
