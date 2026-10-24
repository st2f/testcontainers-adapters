[![CI](https://github.com/st2f/testcontainers-adapters/actions/workflows/ci.yml/badge.svg)](https://github.com/st2f/testcontainers-adapters/actions/workflows/ci.yml)

# Testcontainers adapters demo

A small Node.js + TypeScript demo of testing interchangeable persistence adapters against real infrastructure with Testcontainers. PostgreSQL and OpenSearch implement the same repository contract and are exercised by a shared integration test suite using disposable containers.

The demo uses an Article domain model to explore how the same application contract can map naturally to different persistence models. PostgreSQL uses MikroORM with relational sections and a JSONB value object, while OpenSearch stores the complete article as a document. The example also exercises aggregate persistence, transactions, rollback, and adapter-specific failure behavior.

## Repository contract

The application depends on `ArticleRepository`, which creates, reads, and updates complete `Article` aggregates. Both adapters preserve the same observable behavior through a shared integration test contract.

`Article` is the aggregate root: sections and the image are persisted through the same repository, with no separate repositories for them.

| Article field        | PostgreSQL                    | OpenSearch            |
| -------------------- | ----------------------------- | --------------------- |
| `id`                 | `articles.article_id`         | `_id`                 |
| `title`              | `articles.title`              | `headline`            |
| `status`             | `articles.publication_status` | `state`               |
| `image`              | `articles.image` (JSONB)      | `image` object        |
| `sections[].id`      | `sections.section_id` | `sections[].id`       |
| `sections[].title`   | `sections.title`      | `sections[].headline` |
| `sections[].content` | `sections.body`       | `sections[].content`  |
| Section order        | `sections.position`   | Array order           |

## Atomic persistence

PostgreSQL maps the aggregate to `ArticleEntity` and `SectionEntity`. MikroORM's Unit of Work persists changes to the article and its sections inside a transaction, so a failed write rolls back the complete change.

OpenSearch stores the complete aggregate as one document and replaces it atomically on update. A failed replacement leaves the previous document intact.

These guarantees prevent partial saves. They do not prevent concurrent updates from overwriting each other.

## Application example

The same use case accepts either adapter. With an initialized PostgreSQL MikroORM instance `orm`, OpenSearch `client`, and their table/index:

```ts
import { randomUUID } from "node:crypto";
import type { ArticleRepository } from "./src/application/ports/ArticleRepository.js";
import { CreateArticle } from "./src/application/use-cases/CreateArticle.js";
import { MikroOrmArticleRepository } from "./src/adapters/outbound/postgres/MikroOrmArticleRepository.js";
import { OpenSearchArticleRepository } from "./src/adapters/outbound/opensearch/OpenSearchArticleRepository.js";

function createDraft(repository: ArticleRepository): Promise<void> {
  return new CreateArticle(repository).execute({
    id: randomUUID(),
    title: "Example article",
    status: "draft",
    image: {
      url: "https://example.com/article.jpg",
      alt: "Example image",
    },
    sections: [
      { id: "intro", title: "Introduction", content: "An article aggregate." },
      {
        id: "body",
        title: "Body",
        content: "The application uses the same repository contract.",
      },
    ],
  });
}

await createDraft(new MikroOrmArticleRepository(orm.em));
await createDraft(new OpenSearchArticleRepository(client, "articles"));
```

## Project structure

The application depends on the repository port; each persistence implementation lives in its own outbound adapter. Both adapter implementations are exercised by the same [integration-test contract](test/integration/contract/article-repository.contract.ts).

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
        │   ├── ArticleEntity.ts
        │   ├── MikroOrmArticleRepository.ts
        │   ├── SectionEntity.ts
        │   └── orm-config.ts
        └── opensearch/
            ├── OpenSearchArticleRepository.ts
            └── index-setup.ts

test/
└── integration/
    ├── contract/
    │   ├── article-fixture.ts
    │   └── article-repository.contract.ts
    ├── postgres/
    │   └── MikroOrmArticleRepository.test.ts
    └── opensearch/
        └── OpenSearchArticleRepository.test.ts
```

Each integration fixture starts its database with Testcontainers, initializes the required schema or index, runs the shared repository contract, then closes the client and container.

Domain and application code have no MikroORM or OpenSearch client dependencies.

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

For Colima, use the matching wrappers, eg `npm run test:colima`, `npm run test:colima:ui`.

The [CI workflow](.github/workflows/ci.yml) checks types and runs each adapter suite independently on pull requests and pushes to `main`.

## Tests execution

### Vitest UI and module graph dependencies

OpenSearch <img width="2446" height="1242" alt="image" src="https://github.com/user-attachments/assets/e8a8f43e-6487-4460-8ed9-1ebd9e6c257b" />

Postgres <img width="2492" height="1314" alt="image" src="https://github.com/user-attachments/assets/04ff5ee1-23be-4f17-a9e4-c85568f3f475" />

### CI

<img width="800" src="https://github.com/user-attachments/assets/2e585873-7d34-4b3d-9ee0-6d4a4d45fc1b" />

### Comparison

| Adapter    | Local suite (Vitest) | CI test step | Full CI job |
| ---------- | -------------------: | -----------: | ----------: |
| PostgreSQL |               2.33 s |          8 s |        33 s |
| OpenSearch |               9.34 s |         51 s |  1 min 30 s |

Sample timings from a local run and CI. Suite times include container startup and cleanup; full CI jobs also include setup and dependency installation. Timings vary with image caching and runner resources.

OpenSearch’s integration suite took longer in these runs. These timings include container startup and initialization, so they don’t establish a difference in read/write performance between the databases.
