# Testcontainers adapters demo

A small Node.js + TypeScript project demonstrating how the same repository contract can be integration-tested against different persistence adapters using Testcontainers and Vitest.

The demo uses PostgreSQL and OpenSearch implementations with deliberately different persistence models. Shared contract tests verify the same application behavior against each real dependency, while infrastructure-specific tests cover behavior such as PostgreSQL constraints and OpenSearch mappings.

## Setup

```sh
nvm install
nvm use
npm ci
npm run typecheck
```

## Test commands

| Command                      | Purpose                                    |
| ---------------------------- | ------------------------------------------ |
| `npm test`                   | Run both integration suites once           |
| `npm run test:postgres`      | Run only PostgreSQL tests once             |
| `npm run test:opensearch`    | Run only OpenSearch tests once             |
| `npm run test:ui`            | Open interactive Vitest UI for both suites |
| `npm run test:ui:postgres`   | Open Vitest UI for PostgreSQL              |
| `npm run test:ui:opensearch` | Open Vitest UI for OpenSearch              |

Tests will live in `test/integration/postgres/**/*.test.ts` and `test/integration/opensearch/**/*.test.ts`. The shared contract helper is imported by these suites and is not discovered as a separate test file.
