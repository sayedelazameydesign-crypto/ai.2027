import { Decision } from "./decision";
import { Task } from "./types";

export interface AgentToolDescription {
  readonly name: string;
  readonly description: string;
}

export interface AgentContext {
  readonly task: Readonly<Task>;
  readonly availableTools: readonly AgentToolDescription[];
}

/**
 * An Agent decides what should happen next. It does not execute Tools,
 * mutate Task lifecycle, create Executions, or record Evidence.
 */
export interface Agent {
  readonly name: string;
  decide(context: AgentContext): Promise<Decision> | Decision;
}
