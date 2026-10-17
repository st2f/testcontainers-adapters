# Testcontainers adapters demo

A small Node.js + TypeScript demo of interchangeable PostgreSQL and OpenSearch persistence adapters. Shared contract tests exercise the same application behavior against real, disposable infrastructure started by Testcontainers.

## Setup

Use Node.js 24, npm, and a running Docker-compatible runtime. With nvm installed:

```sh
nvm install
nvm use
npm ci
npm run typecheck
```

## Test commands

| Purpose | Command |
| --- | --- |
| Both suites | `npm test` |
| PostgreSQL | `npm run test:postgres` |
| OpenSearch | `npm run test:opensearch` |
| Vitest UI | `npm run test:ui` |
| PostgreSQL UI | `npm run test:ui:postgres` |
| OpenSearch UI | `npm run test:ui:opensearch` |

Tests run once; UI commands stay in watch mode. The shared contract helper is imported by both suites.

Both suites run the same repository contract against real containers. PostgreSQL also checks its status constraint; OpenSearch checks its mapping and missing-index errors. OpenSearch uses real-time document reads by ID, so these tests need no search refresh delays.

The [CI workflow](.github/workflows/ci.yml) checks types and runs each adapter suite independently on pull requests and pushes to `main`.

## Optional: Colima

```sh
npm run test:colima
npm run test:colima:postgres
npm run test:colima:opensearch
npm run test:colima:ui
npm run test:colima:ui:postgres
npm run test:colima:ui:opensearch
```
