# Contributing

Work from `dev` and create short-lived branches using `feature/*`, `fix/*`, or `chore/*`. Keep commits focused and avoid committing secrets, local environment files, generated artifacts, or credentials.

Run `make setup` once per checkout to configure the local pre-push hook. Before opening a pull request, run `make lint`, `make type-check`, and `make test` when the corresponding project tooling exists. Update documentation and `CHANGELOG.md` when behavior or public interfaces change.

Changes to prompts should be versioned under `prompts/v1/`, `prompts/v2/`, and so on. Do not overwrite a prompt version that is already used by an evaluation or production workflow. Add or update an evaluation fixture when changing prompt behavior.

Pull requests target `dev` unless they are a release or maintenance change explicitly approved for `main`. At least one reviewer should be recorded in the pull request, and the checklist in the pull request template should be completed.
