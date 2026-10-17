# Testcontainers Demo

## Goal

Build a small Node.js + TypeScript project demonstrating integration testing of two implementations of the same persistence contract against real, disposable infrastructure using Testcontainers.

Keep the project intentionally small. The focus is infrastructure testing and adapter interchangeability, not domain complexity.

## Domain

Use a minimal `Article`:

```ts
type Article = {
  id: string;
  title: string;
  content: string;
  status: "draft" | "published";
};
```

Deliberately use different persistence representations:

| Domain field | PostgreSQL           | OpenSearch |
| ------------ | -------------------- | ---------- |
| `id`         | `article_id`         | `_id`      |
| `title`      | `title`              | `headline` |
| `content`    | `body`               | `content`  |
| `status`     | `publication_status` | `state`    |

No framework, HTTP API, authentication, ORM, events, or UI is needed.

## Application Contract

Define an `ArticleRepository` contract independent of the persistence technology.

It should support the minimum operations necessary to demonstrate:

- Creating an article
- Retrieving an article by ID
- Updating an article

Avoid exposing PostgreSQL or OpenSearch concepts through this interface.

## Implementations

Provide two independent implementations of `ArticleRepository`:

```text
ArticleRepository
├── PostgreSQL implementation
└── OpenSearch implementation
```

### PostgreSQL

- Use a real PostgreSQL instance started by Testcontainers.
- Keep the schema minimal and explicit.
- Do not introduce an ORM unless there is a concrete reason for it.

### OpenSearch

- Use a real OpenSearch instance started by Testcontainers.
- Create an explicit index mapping appropriate for `Article`.
- Keep OpenSearch-specific configuration inside its adapter.

## Tests

Use Vitest.

Create a shared repository contract test that can be executed against both implementations. The shared contract should verify at least:

- Create → find by ID
- Create → update → find by ID
- Missing ID → `null`

Add infrastructure-specific tests only where they demonstrate behavior that belongs to that technology. Examples:

- PostgreSQL: schema or constraint, if useful
- OpenSearch: mapping

Do not mock PostgreSQL or OpenSearch in these integration tests.

## Testcontainers

Each integration suite should start the infrastructure it requires through Testcontainers.

Avoid starting a new container for every individual test. Prefer an appropriate suite-level lifecycle while keeping tests isolated and deterministic.

The tests should be runnable independently:

```sh
# ci
npm run test:postgres
npm run test:opensearch
# local/colima
npm run test:colima:postgres
npm run test:colima:opensearch
```

Also configure the project so the suites are easy to demonstrate through Vitest UI.

For colima, you may use https://github.com/st2f/node-concurrency-patterns/blob/main/package.json

## Suggested Structure

```text
src/
├── domain/
│   └── article.ts
├── application/
│   ├── ports/
│   │   └── article-repository.ts
│   └── use-cases/
│       ├── create-article.ts
│       └── update-article.ts
└── adapters/
    └── outbound/
        ├── postgres/
        │   └── postgres-article-repository.ts
        └── opensearch/
            └── opensearch-article-repository.ts

test/
└── integration/
    ├── contract/
    │   └── article-repository.contract.ts
    ├── postgres/
    │   └── ...
    └── opensearch/
        └── ...
```

Adjust filenames or small structural details when implementation needs justify it, but preserve the separation between domain/application code and infrastructure-specific code.

## Constraints

- Keep dependencies and abstractions minimal.
- Prefer explicit code over infrastructure/framework magic.
- Do not add abstractions solely in anticipation of future requirements.
- Do not implement concurrency control yet.

The resulting project should make it easy to understand that the application depends on an `ArticleRepository` contract while PostgreSQL and OpenSearch are replaceable implementations of that contract.

A later exercise may introduce concurrent article editing and compare the guarantees provided by PostgreSQL and OpenSearch. Do not design or implement that exercise yet.
