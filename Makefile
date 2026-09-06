.PHONY: setup test lint type-check run

setup:
	git config core.hooksPath scripts/hooks
	@command -v pre-commit >/dev/null 2>&1 && pre-commit install || echo "pre-commit is not installed; install it to enable local commit checks."

test:
	@if [ -f package.json ]; then npm test --if-present; \
	elif [ -f pyproject.toml ]; then python -m pytest -q; \
	else echo "No test runner configured yet."; fi

lint:
	@if [ -f package.json ]; then npm run lint --if-present; \
	elif [ -f pyproject.toml ] && command -v ruff >/dev/null 2>&1; then python -m ruff check src tests; \
	else echo "No linter configured yet."; fi

type-check:
	@if [ -f package.json ]; then npm run type-check --if-present; \
	elif [ -f pyproject.toml ] && command -v mypy >/dev/null 2>&1; then python -m mypy src; \
	else echo "No type checker configured yet."; fi

run:
	@if [ -f package.json ]; then npm run dev --if-present; \
	elif [ -f pyproject.toml ]; then python -m src; \
	else echo "No runtime configured yet."; fi
