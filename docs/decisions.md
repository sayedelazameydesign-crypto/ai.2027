# Architecture Decision Records

## ADR-0001: Repository foundation

- **Status:** Accepted
- **Date:** 2026-09-06
- **Decision:** Start `ai.2027` as an independent repository with separate directories for implementation, tests, configuration, prompts, and documentation.
- **Rationale:** The project is expected to evolve toward AI/agent work. Keeping prompts and skills separate from executable code supports review, reuse, and safer changes.
- **Consequences:** The concrete runtime stack remains intentionally undecided until the first implementation is added. New stack choices should be recorded here as additional ADRs.
