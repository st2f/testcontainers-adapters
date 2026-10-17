[![CI](https://github.com/st2f/testcontainers-adapters/actions/workflows/ci.yml/badge.svg)](https://github.com/st2f/testcontainers-adapters/actions/workflows/ci.yml)

# Testcontainers adapters demo

A small Node.js + TypeScript demo of interchangeable PostgreSQL and OpenSearch persistence adapters. Shared contract tests exercise the same application behavior against real, disposable infrastructure started by Testcontainers.

## Repository contract

The application depends on `ArticleRepository`:

- `create(article)` stores an article with its caller-supplied ID.
- `findById(id)` returns the article or `null`.
- `update(article)` replaces its editable fields, preserving the ID. It returns `true` if the article existed, or `false` without creating it if missing.

Each adapter maps the same domain data to its own persistence representation:

| Article field | PostgreSQL           | OpenSearch |
| ------------- | -------------------- | ---------- |
| `id`          | `article_id`         | `_id`      |
| `title`       | `title`              | `headline` |
| `content`     | `body`               | `content`  |
| `status`      | `publication_status` | `state`    |

The same use case accepts either adapter. With an initialized PostgreSQL `pool`, OpenSearch `client`, and their table/index:

```ts
import { randomUUID } from "node:crypto";
import type { ArticleRepository } from "./src/application/ports/ArticleRepository.js";
import { CreateArticle } from "./src/application/use-cases/CreateArticle.js";
import { PostgresArticleRepository } from "./src/adapters/outbound/postgres/PostgresArticleRepository.js";
import { OpenSearchArticleRepository } from "./src/adapters/outbound/opensearch/OpenSearchArticleRepository.js";

function createDraft(repository: ArticleRepository): Promise<void> {
  return new CreateArticle(repository).execute({
    id: randomUUID(),
    title: "Example article",
    content: "The application uses the same repository contract.",
    status: "draft",
  });
}

await createDraft(new PostgresArticleRepository(pool));
await createDraft(new OpenSearchArticleRepository(client, "articles"));
```

## Project structure

The application depends on the repository port; each persistence implementation lives in its own outbound adapter. Both adapter implementations are exercised by the same integration-test contract.

```txt
src/
├── domain/
│   └── Article.ts
├── application/
│   ├── ports/
│   │   └── ArticleRepository.ts
│   └── use-cases/
│       ├── CreateArticle.ts
│       └── UpdateArticle.ts
└── adapters/
    └── outbound/
        ├── postgres/
        │   └── PostgresArticleRepository.ts
        └── opensearch/
            └── OpenSearchArticleRepository.ts

test/
└── integration/
    ├── contract/
    │   └── article-repository.contract.ts
    ├── postgres/
    │   └── ...
    └── opensearch/
        └── ...
```

## Setup

Use Node.js 24, npm, and a running Docker-compatible runtime. With nvm installed:

```sh
nvm install
nvm use
npm ci
npm run typecheck
```

## Test commands

| Purpose       | Command                      |
| ------------- | ---------------------------- |
| Both suites   | `npm test`                   |
| PostgreSQL    | `npm run test:postgres`      |
| OpenSearch    | `npm run test:opensearch`    |
| Vitest UI     | `npm run test:ui`            |
| PostgreSQL UI | `npm run test:ui:postgres`   |
| OpenSearch UI | `npm run test:ui:opensearch` |

Tests run once; UI commands stay in watch mode. The shared contract helper is imported by both suites.

Both suites run the same repository contract against real containers. PostgreSQL also checks its status constraint; OpenSearch checks its mapping and missing-index errors. OpenSearch uses real-time document reads by ID, so these tests need no search refresh delays.

The [CI workflow](.github/workflows/ci.yml) checks types and runs each adapter suite independently on pull requests and pushes to `main`.

See optional colima commands in [/package.json](/package.json)

## Tests execution

### Vitest UI and module graph dependencies

OpenSearch <img width="2512" height="1352" alt="image" src="https://github.com/user-attachments/assets/3a2ea9ea-71a4-4bf5-83d9-afda7ea7aade" />

Postgres <img width="2492" height="1384" alt="image" src="https://github.com/user-attachments/assets/a82beeca-8a52-4508-b04a-128a78744ea9" />

### CI

<img width="800" src="https://github.com/user-attachments/assets/ffe7d125-3148-40e9-9f37-65d377f6964d" />

### Comparison

| Adapter    | Local suite (Vitest) | CI test step | Full CI job |
| ---------- | -------------------: | -----------: | ----------: |
| PostgreSQL |               2.17 s |         12 s |        47 s |
| OpenSearch |               8.92 s |         41 s |   1 min 3 s |

Sample timings from a local run and CI. Suite times include container startup and cleanup; full CI jobs also include setup and dependency installation. Timings vary with image caching and runner resources.

OpenSearch’s integration suite took longer in these runs. These timings include container startup and initialization, so they don’t establish a difference in read/write performance between the databases.
