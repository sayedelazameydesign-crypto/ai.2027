import { Agent, AgentContext } from "./agent";
import { Decision, ToolRequest } from "./decision";
import { Result, Task } from "./types";

export interface DeterministicAgentOptions {
  readonly name: string;
  readonly matches: (task: Readonly<Task>) => boolean;
  readonly toolName: string;
  readonly createInput: (task: Readonly<Task>) => unknown;
  readonly now: () => string;
  readonly fallback?: (task: Readonly<Task>) => Result;
}

/**
 * Small deterministic reference Agent. It decides from a configured rule and
 * returns a Decision; it has no Tool registry and cannot execute anything.
 */
export class DeterministicAgent implements Agent {
  readonly name: string;

  private readonly matches: DeterministicAgentOptions["matches"];
  private readonly toolName: string;
  private readonly createInput: DeterministicAgentOptions["createInput"];
  private readonly now: DeterministicAgentOptions["now"];
  private readonly fallback: (task: Readonly<Task>) => Result;

  constructor(options: DeterministicAgentOptions) {
    this.name = options.name;
    this.matches = options.matches;
    this.toolName = options.toolName;
    this.createInput = options.createInput;
    this.now = options.now;
    this.fallback =
      options.fallback ?? ((task) => ({
        taskId: task.id,
        status: "failure",
        summary: "No deterministic rule matched the task.",
        producedAt: this.now(),
      }));
  }

  decide({ task }: AgentContext): Decision {
    if (this.matches(task)) {
      const decision: ToolRequest = {
        kind: "tool_request",
        toolName: this.toolName,
        input: this.createInput(task),
      };
      return decision;
    }

    return { kind: "final", result: this.fallback(task) };
  }
}
