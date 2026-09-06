# ai.2027

A standalone workspace for AI experiments, agents, prompts, and supporting tools.

## Status

Initial repository bootstrap. The implementation stack will be recorded in `docs/decisions.md` when selected.

## Repository layout

- `src/` — application and agent implementation
- `tests/` — automated tests
- `config/` — non-secret configuration templates and schemas
- `prompts/` — prompts and agent instructions, kept separate from execution code
- `docs/` — architecture decisions and project documentation

## Requirements

Requirements will be added with the first implementation. Do not commit real credentials or local environment files.

## Development

Create a local environment from the example file when needed:

```bash
cp .env.example .env
```

Run the project checks with the commands documented by the implementation as it is added. Pull requests are validated by GitHub Actions.

## Branching

- `main` is the protected release branch.
- `dev` is the default integration branch for daily work.
- Use `feature/*`, `fix/*`, or `chore/*` for short-lived branches.

## License

This project is distributed under the MIT License. See [LICENSE](LICENSE).
