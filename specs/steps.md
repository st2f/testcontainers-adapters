# Implementation steps

Build the smallest working example described in [goal.md](./goal.md). Complete each step before moving on; keep this file updated as work progresses. Keep documentation focused on the demo; report local environment details and diagnostic logs in chat only.

## 1. Establish the project and test commands

- [x] Select a supported Node.js LTS release and compatible package versions. Check the available Docker-compatible runtime.
- [x] Initialize a private npm package with TypeScript, strict type checking, and one consistent module format (prefer ESM). Generate the npm lockfile for inclusion with the project files.
- [x] Add only the runtime dependencies needed by the adapters: `pg` and `@opensearch-project/opensearch`. Add TypeScript, necessary type declarations, Vitest, `@vitest/ui`, and Testcontainers packages as development dependencies.
- [x] Use Testcontainers' PostgreSQL module. Check whether the selected Testcontainers version provides an appropriate OpenSearch module; otherwise use `GenericContainer` with explicit configuration and readiness checks.
- [x] Configure Vitest to select the PostgreSQL and OpenSearch suites independently using explicit file paths or include patterns. Keep the shared contract helper outside test-file discovery.
- [x] Define `typecheck`, `test`, `test:postgres`, `test:opensearch`, and Vitest UI scripts. The ordinary test scripts must terminate after one run; UI scripts should remain interactive. Provide UI commands for selecting either adapter.
- [x] Add `.gitignore` entries for dependencies, build output, and generated test artifacts. Avoid adding a framework, bundler, linter stack, or build pipeline unless required.

**Checkpoint:** installation, type checking, and suite selection verified.

## 2. Verify container execution early

- [x] Check the runtime meets the demo and OpenSearch prerequisites. Keep resource cleanup enabled.
- [x] Run a temporary Testcontainers smoke check for startup, connectivity, and cleanup before implementing the adapters.
- [x] Verify Vitest UI startup.
- [x] Provide optional Colima command wrappers for users who need them. Keep the standard commands runtime-neutral.

**Checkpoint:** container connectivity, cleanup, and UI startup verified.

## 3. Define the domain and persistence contract

- [x] Create `src/domain/Article.ts` with exactly the `Article` fields and status union specified in the goal.
- [x] Create `src/application/ports/ArticleRepository.ts` with asynchronous `create(article)`, `findById(id)`, and `update(article)` operations.
- [x] Use these simple semantics consistently: `create` resolves without a result; `findById` returns `Article | null`; `update` replaces the editable fields of an existing article and returns a boolean indicating whether it existed. Updating must preserve the ID and must not insert a missing article.
- [x] Document those semantics next to the interface. Keep database types, clients, container configuration, and concurrency tokens out of the domain and application layers.
- [x] Add thin `CreateArticle` and `UpdateArticle` classes with constructor-injected `ArticleRepository` dependencies and `execute(article)` methods. Keep ID generation with the caller and omit validation or workflows not required by the goal.

**Checkpoint:** type checking passes; domain and application have no infrastructure dependencies.

## 4. Write the reusable contract tests

- [ ] Add `test/integration/contract/article-repository.contract.ts` exporting a function that registers the same Vitest cases for any repository instance. Accept a repository getter so suite setup can initialize it before tests execute.
- [ ] Cover create → find, create → update → find, and missing ID → `null`. Assert full domain-object equality, update all editable fields, and verify that the ID stays unchanged.
- [ ] Cover the documented update result for existing and missing IDs, including that a missing update does not create an article.
- [ ] Give every case a distinct ID with `crypto.randomUUID()`. Avoid order dependence and shared records; do not add delete to the application contract solely for test cleanup.
- [ ] Exercise the thin use cases in the shared create/update scenarios so the example shows application code working with both adapters through the same port.

**Checkpoint:** the helper contains no PostgreSQL or OpenSearch knowledge and can be registered unchanged by both suites.

## 5. Implement and verify PostgreSQL

- [ ] Add a `PostgresArticleRepository` class implementing `ArticleRepository` in `src/adapters/outbound/postgres/PostgresArticleRepository.ts`, using a constructor-injected `pg` pool and parameterized SQL.
- [ ] Define explicit setup DDL for an `articles` table with `article_id`, `title`, `body`, and `publication_status`. Use a text primary key, required fields, and a check constraint for the two statuses.
- [ ] Keep database setup in a small PostgreSQL-specific helper or SQL file reused by the integration fixture. Avoid migration tooling for this single-table demo.
- [ ] Map database rows explicitly to `Article`; use the affected row count to implement the update result.
- [ ] In the PostgreSQL integration suite, start one pinned PostgreSQL image in `beforeAll`, create the pool from the container connection information, initialize the table, and register the shared contract.
- [ ] Close the pool before stopping the container in `afterAll`. Make cleanup tolerate partial setup failure and ensure a pool-close error cannot skip container shutdown.
- [ ] Add one useful PostgreSQL-specific test, such as proving the status constraint rejects an invalid stored value through direct SQL.
- [ ] Run type checking and `npm run test:postgres` (using the optional runtime wrapper when needed) against the real container immediately after implementing the suite; fix failures before starting the second adapter. Open the PostgreSQL suite in Vitest UI and verify a rerun recreates and cleans up its fixture correctly.

**Checkpoint:** the PostgreSQL suite passes independently with one container per suite and deterministic records.

## 6. Implement and verify OpenSearch

- [ ] Add an `OpenSearchArticleRepository` class implementing `ArticleRepository` in `src/adapters/outbound/opensearch/OpenSearchArticleRepository.ts`, using a constructor-injected OpenSearch client and index name. Keep index configuration and representation mapping in the OpenSearch adapter directory.
- [ ] Create an explicit mapping: `headline` and `content` as text fields, `state` as a keyword field, and the article ID as the document `_id`. Consider strict dynamic mapping to make accidental field mismatches visible.
- [ ] Map `{ title, content, status }` to `{ headline, content, state }` on writes and reconstruct the domain ID from document metadata on reads.
- [ ] Use document creation and replacement/update operations with matching contract semantics. Ensure updates cannot upsert missing documents. Translate only document-not-found responses into `null` or `false`; let connection, mapping, missing-index, and other infrastructure errors fail the test.
- [ ] In the OpenSearch suite, start one pinned OpenSearch image in `beforeAll`, configure a local single-node instance, wait for an API readiness condition, initialize the client, and create the index before running the shared contract.
- [ ] Keep container settings explicit, including test-only security configuration and a bounded JVM heap. Use the mapped host and port; do not assume `localhost` or a fixed host port.
- [ ] Use real-time document GET for reads by ID, so the contract needs no sleeps or refresh polling. Do not add search behavior to the repository.
- [ ] Add an OpenSearch-specific test that retrieves and verifies the actual index mapping.
- [ ] Close the client before stopping the container, with the same partial-setup and cleanup guarantees as PostgreSQL.
- [ ] Run type checking and `npm run test:opensearch` (using the optional runtime wrapper when needed) immediately after implementing the suite; tune finite startup/test timeouts based on observed startup behavior rather than adding arbitrary delays. Verify this suite in Vitest UI too.

**Checkpoint:** the unchanged contract passes against OpenSearch and its explicit mapping is verified.

## 7. Add GitHub Actions CI

- [ ] Add `.github/workflows/ci.yml` for pull requests and pushes to the repository's default branch. Use a supported GitHub-hosted Ubuntu runner with Docker available.
- [ ] Use a two-entry matrix for PostgreSQL and OpenSearch so their results are visible independently. Each job checks out the repository, sets up the selected Node.js LTS version with npm caching, runs `npm ci`, runs type checking, and invokes `npm run test:postgres` or `npm run test:opensearch` as appropriate.
- [ ] Let Testcontainers provision infrastructure inside each job. Do not add duplicate workflow service containers or fixed host-port assumptions. Check the selected runner's OpenSearch resource and kernel requirements, and configure any required runner settings explicitly.
- [ ] Set finite job timeouts, read-only repository permissions, and matrix `fail-fast: false` so one adapter failure does not hide the other's result. Use noninteractive test commands and retain useful failure output.
- [ ] Verify both commands locally with the available runtime. Check both CI jobs after the workflow is triggered; report any unverified CI behavior in chat.

**Checkpoint:** CI runs both suites independently and checks types.

## 8. Finish the demonstration and documentation

- [ ] Run type checking and both suites together as the final regression check. The individual suites and UI should already have been verified in steps 5 and 6.
- [ ] Confirm containers are reused across cases within each suite and stopped after runs. Check that UI reruns recreate fixtures cleanly and that independent suites do not share records or require a particular execution order.
- [ ] Write a concise README covering setup, local and CI commands, the contract, and persistence mappings. Include only tooling prerequisites needed to run the demo.
- [ ] Include a short example using the same application use case with either repository. Report outstanding environment checks in chat.

**Completion criteria:** all four commands required by the goal are defined, both real-infrastructure suites pass as they are implemented, the same contract and application use cases exercise both adapters, GitHub Actions is configured for both suites, and the README makes the demo reproducible. Keep concurrency control and the later concurrent-editing exercise out of this implementation.
