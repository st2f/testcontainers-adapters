# Testcontainers Demo

## Goal

Build a small Node.js + TypeScript project demonstrating integration testing of two implementations of the same persistence contract against real, disposable infrastructure using Testcontainers.

Keep the project intentionally small. The main concepts are aggregation, atomic persistence, infrastructure testing, and adapter interchangeability.

## Domain

Use an `Article` aggregate with an image value object and ordered sections:

```ts
type Article = {
  id: string;
  title: string;
  status: "draft" | "published";
  image: {
    url: string;
    alt: string;
  };
  sections: {
    id: string;
    title: string;
    content: string;
  }[];
};
```

`Article` is the aggregate root. Persist it and its sections through one repository operation. Sections have caller-supplied IDs scoped to their article; the image has no independent identity. Allow an empty sections array and preserve section order on reads. Content belongs to sections, with no article-level content field.

Deliberately use different persistence representations:

| Domain field         | PostgreSQL                    | OpenSearch            |
| -------------------- | ----------------------------- | --------------------- |
| `id`                 | `articles.article_id`         | `_id`                 |
| `title`              | `articles.title`              | `headline`            |
| `status`             | `articles.publication_status` | `state`               |
| `image`              | `articles.image` (JSONB)       | `image` object        |
| `sections[].id`      | `article_sections.section_id` | `sections[].id`       |
| `sections[].title`   | `article_sections.title`      | `sections[].headline` |
| `sections[].content` | `article_sections.body`       | `sections[].content`  |
| Section order        | `article_sections.position`   | Array order           |

No framework, HTTP API, authentication, events, or application UI is needed. Use MikroORM inside the PostgreSQL adapter and Vitest UI for the demonstration.

## Application Contract

Define an `ArticleRepository` contract independent of the persistence technology.

It should support the minimum operations necessary to demonstrate:

- `create(article): Promise<void>` atomically stores the complete aggregate using caller-supplied IDs. Duplicate article creation must fail.
- `findById(id): Promise<Article | null>` returns the complete aggregate, or `null` when missing.
- `update(article): Promise<boolean>` atomically replaces the title, status, image, and ordered sections, preserving the article ID. Return `true` if the article existed, otherwise `false` without inserting it. Propagate persistence failures.

Avoid exposing PostgreSQL, MikroORM, or OpenSearch concepts through this interface. Keep sections and images behind the article repository rather than introducing separate repositories.

## Implementations

Provide two independent implementations of `ArticleRepository`:

```text
ArticleRepository
├── MikroOrmArticleRepository (PostgreSQL)
└── OpenSearchArticleRepository
```

### PostgreSQL

- Use a real PostgreSQL instance started by Testcontainers.
- Use MikroORM with explicit entity metadata, managed relationships, cascade persistence, orphan removal, and Unit of Work flushing.
- Keep `ArticleEntity`, `SectionEntity`, ORM configuration, and representation mapping inside `adapters/outbound/postgres`. Domain and application code must have no ORM dependencies.
- Store article fields and the image JSONB value in `articles`. Store sections in `article_sections`, with an article foreign key, a composite primary key of article ID and section ID, and an explicit position.
- Preserve the status check constraint and deterministic section ordering. Section edits, additions, removals, and reordering must persist correctly.
- Use an isolated entity manager per repository operation. Create and update must run in a transaction covering the article and all its sections, so a section write failure leaves no partial changes.
- Create the disposable schema from entity metadata in the integration fixture. Keep production migrations outside this demo.

### OpenSearch

- Use a real OpenSearch instance started by Testcontainers.
- Create an explicit index mapping appropriate for `Article`.
- Keep OpenSearch-specific configuration inside its adapter.
- Store the image and ordered sections inside one article document. Use one document write per create or update, with complete source replacement on update and no upsert of missing articles.
- Use real-time reads by ID; no search API or refresh polling is required. Propagate mapping, missing-index, and other infrastructure errors.

## Tests

Use Vitest.

Create a shared repository contract test that can be executed against both implementations. The shared contract should verify at least:

- Create → find by ID, asserting complete aggregate equality
- Create → update → find by ID, changing all editable fields
- Section edits, additions, removals, reordering, and empty arrays
- Independent articles using the same local section IDs
- Missing ID → `null`
- Missing update → `false`, without creating an article

Add infrastructure-specific tests where they demonstrate behavior belonging to that technology:

- PostgreSQL: status constraint, fresh reads, and recovery after a duplicate insert. Cause real section insert/update failures through a test-only database constraint, then verify with fresh SQL reads that create leaves no partial rows and update preserves the complete previous aggregate.
- OpenSearch: explicit mapping, missing-index errors, and a rejected document replacement preserving the complete previous aggregate.

Do not mock PostgreSQL or OpenSearch in these integration tests.

## Testcontainers

Each integration suite should start the infrastructure it requires through Testcontainers.

Avoid starting a new container for every individual test. Prefer an appropriate suite-level lifecycle while keeping tests isolated and deterministic.

Close database clients before stopping containers. Cleanup must tolerate partial setup failure, and a client-close error must not skip container shutdown. Vitest UI reruns must create fresh fixtures and clean them up again.

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

Keep standard commands runtime-neutral and provide optional Colima wrappers for run and UI modes.

## Suggested Structure

```text
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
        │   ├── SectionEntity.ts
        │   ├── MikroOrmArticleRepository.ts
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

Adjust filenames or small structural details when implementation needs justify it, but preserve the separation between domain/application code and infrastructure-specific code.

Prefer classes for use cases and repository adapter implementations. Use constructor injection for use-case dependencies. Keep the domain model as simple TypeScript data and the repository port as an interface. Tests and test factories do not need to be classes.

Naming: When a file is centered on a single named domain or architectural type (class, interface, or type), use the same PascalCase name for the file (e.g. CreateArticle.ts, ArticleRepository.ts, MikroOrmArticleRepository.ts). Keep utility/setup files in kebab-case or their conventional lowercase form.

## Constraints

- Keep dependencies and abstractions minimal.
- Prefer explicit code over infrastructure/framework magic.
- Do not add abstractions solely in anticipation of future requirements.
- Do not implement concurrency control yet.

The resulting project should make it easy to understand that the application depends on an `ArticleRepository` contract while PostgreSQL and OpenSearch are replaceable implementations of that contract.

A later exercise may introduce concurrent article editing and compare the guarantees provided by PostgreSQL and OpenSearch. Do not design or implement that exercise yet.

Atomic persistence means a save succeeds or fails as a whole. It does not prevent a concurrent editor from overwriting another editor's changes. Leave version fields, locking strategies, conflict handling, and concurrent-editing tests for that later exercise.
