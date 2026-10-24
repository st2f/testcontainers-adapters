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

- [x] Add `test/integration/contract/article-repository.contract.ts` exporting a function that registers the same Vitest cases for any repository instance. Accept a repository getter so suite setup can initialize it before tests execute.
- [x] Cover create → find, create → update → find, and missing ID → `null`. Assert full domain-object equality, update all editable fields, and verify that the ID stays unchanged.
- [x] Cover the documented update result for existing and missing IDs, including that a missing update does not create an article.
- [x] Give every case a distinct ID with `crypto.randomUUID()`. Avoid order dependence and shared records; do not add delete to the application contract solely for test cleanup.
- [x] Exercise the thin use cases in the shared create/update scenarios so the example shows application code working with both adapters through the same port.

**Checkpoint:** shared contract cases added and type checking passes. Execution follows with each adapter.

## 5. Implement and verify PostgreSQL

- [x] Add the original PostgreSQL adapter implementing `ArticleRepository`, using a constructor-injected `pg` pool and parameterized SQL. Step 9 replaces this implementation with MikroORM.
- [x] Define explicit setup DDL for an `articles` table with `article_id`, `title`, `body`, and `publication_status`. Use a text primary key, required fields, and a check constraint for the two statuses.
- [x] Keep database setup in a small PostgreSQL-specific helper or SQL file reused by the integration fixture. Avoid migration tooling for this single-table demo.
- [x] Map database rows explicitly to `Article`; use the affected row count to implement the update result.
- [x] In the PostgreSQL integration suite, start one pinned PostgreSQL image in `beforeAll`, create the pool from the container connection information, initialize the table, and register the shared contract.
- [x] Close the pool before stopping the container in `afterAll`. Make cleanup tolerate partial setup failure and ensure a pool-close error cannot skip container shutdown.
- [x] Add one useful PostgreSQL-specific test, such as proving the status constraint rejects an invalid stored value through direct SQL.
- [x] Run type checking and `npm run test:postgres` (using the optional runtime wrapper when needed) against the real container immediately after implementing the suite; fix failures before starting the second adapter. Open the PostgreSQL suite in Vitest UI and verify a rerun recreates and cleans up its fixture correctly.

**Checkpoint:** five PostgreSQL tests pass; type checking, UI reruns, and container cleanup verified.

## 6. Implement and verify OpenSearch

- [x] Add an `OpenSearchArticleRepository` class implementing `ArticleRepository` in `src/adapters/outbound/opensearch/OpenSearchArticleRepository.ts`, using a constructor-injected OpenSearch client and index name. Keep index configuration and representation mapping in the OpenSearch adapter directory.
- [x] Create an explicit mapping: `headline` and `content` as text fields, `state` as a keyword field, and the article ID as the document `_id`. Consider strict dynamic mapping to make accidental field mismatches visible.
- [x] Map `{ title, content, status }` to `{ headline, content, state }` on writes and reconstruct the domain ID from document metadata on reads.
- [x] Use document creation and replacement/update operations with matching contract semantics. Ensure updates cannot upsert missing documents. Translate only document-not-found responses into `null` or `false`; let connection, mapping, missing-index, and other infrastructure errors fail the test.
- [x] In the OpenSearch suite, start one pinned OpenSearch image in `beforeAll`, configure a local single-node instance, wait for an API readiness condition, initialize the client, and create the index before running the shared contract.
- [x] Keep container settings explicit, including test-only security configuration and a bounded JVM heap. Use the mapped host and port; do not assume `localhost` or a fixed host port.
- [x] Use real-time document GET for reads by ID, so the contract needs no sleeps or refresh polling. Do not add search behavior to the repository.
- [x] Add an OpenSearch-specific test that retrieves and verifies the actual index mapping.
- [x] Close the client before stopping the container, with the same partial-setup and cleanup guarantees as PostgreSQL.
- [x] Run type checking and `npm run test:opensearch` (using the optional runtime wrapper when needed) immediately after implementing the suite; tune finite startup/test timeouts based on observed startup behavior rather than adding arbitrary delays. Verify this suite in Vitest UI too.

**Checkpoint:** six OpenSearch tests pass; type checking, UI reruns, and container cleanup verified. Both suites pass together (11 tests).

## 7. Add GitHub Actions CI

- [x] Add `.github/workflows/ci.yml` for pull requests and pushes to the repository's default branch. Use a supported GitHub-hosted Ubuntu runner with Docker available.
- [x] Use a two-entry matrix for PostgreSQL and OpenSearch so their results are visible independently. Each job checks out the repository, sets up the selected Node.js LTS version with npm caching, runs `npm ci`, runs type checking, and invokes `npm run test:postgres` or `npm run test:opensearch` as appropriate.
- [x] Let Testcontainers provision infrastructure inside each job. Do not add duplicate workflow service containers or fixed host-port assumptions. Check the selected runner's OpenSearch resource and kernel requirements, and configure any required runner settings explicitly.
- [x] Set finite job timeouts, read-only repository permissions, and matrix `fail-fast: false` so one adapter failure does not hide the other's result. Use noninteractive test commands and retain useful failure output.
- [x] Verify both commands locally with the available runtime.
- [x] Check both CI jobs after the workflow is triggered.

**Checkpoint:** workflow validation, local checks, and both CI jobs pass.

## 8. Finish the demonstration and documentation

- [x] Run type checking and both suites together as the final regression check. The individual suites and UI should already have been verified in steps 5 and 6.
- [x] Confirm containers are reused across cases within each suite and stopped after runs. Check that UI reruns recreate fixtures cleanly and that independent suites do not share records or require a particular execution order.
- [x] Write a concise README covering setup, local and CI commands, the contract, and persistence mappings. Include only tooling prerequisites needed to run the demo.
- [x] Include a short example using the same application use case with either repository. Report outstanding environment checks in chat.

**Checkpoint:** documentation complete; type checking and all 11 integration tests pass. Cleanup verified.

**Original demo completion criteria:** all four commands required by the goal are defined, both real-infrastructure suites pass as they are implemented, the same contract and application use cases exercise both adapters, GitHub Actions is configured for both suites, and the README makes the demo reproducible. Keep concurrency control and the later concurrent-editing exercise out of this implementation.

## Add-ons: aggregates and atomic persistence

Steps 1–8 record the completed flat-model demo. Extend it in the following three steps, with one commit per step. Each implementation commit includes its tests and must pass before proceeding.

The main concepts to demonstrate are the aggregate boundary and atomic persistence. Use relational tables for PostgreSQL and one document per article for OpenSearch. Keep concurrency control for a later exercise.

## 9. Introduce MikroORM for the existing PostgreSQL model

- [x] Select compatible MikroORM packages and configure them explicitly inside the PostgreSQL adapter. Update dependencies and the lockfile; remove direct `pg` dependencies only if no longer used directly.
- [x] Keep the current flat `Article` shape for this step. Introduce a PostgreSQL persistence entity and explicit mapping to and from the domain object, preserving the existing column names and status constraint.
- [x] Replace direct SQL in `MikroOrmArticleRepository` with MikroORM while preserving the repository contract, including update returning `false` without inserting a missing article.
- [x] Keep ORM entities, configuration, and entity-manager lifecycle inside the PostgreSQL adapter and its fixture. Domain and application code must have no ORM dependencies. Use an isolated entity manager for each repository operation so unrelated operations do not share pending changes or cached entities.
- [x] Adapt the Testcontainers fixture to initialize MikroORM and create the schema for its disposable database. Keep schema setup explicit and small; do not introduce a production migration workflow for this demo.
- [x] Preserve the PostgreSQL constraint test and cleanup guarantees: close the ORM before stopping the container, including when setup or cleanup fails.
- [x] Run type checking and both integration suites against real containers to establish that the ORM migration preserves behavior.

**Checkpoint:** the flat-model demo passes with MikroORM behind the PostgreSQL adapter and the same application contract. Type checking and all 13 integration tests pass (seven PostgreSQL, six OpenSearch), including fresh-read and failed-write isolation checks.

**Commit:** `refactor: migrate PostgreSQL article adapter to MikroORM`

## 10. Persist article aggregates atomically

- [x] Change `Article` to contain `id`, `title`, `status`, a required `image` (`url`, `alt`), and an ordered `sections` array. Each section contains `id`, `title`, and `content`. Move article-level content into sections and remove the article-level `content` field.
- [x] Keep domain models as plain TypeScript data. Treat `Article` as the aggregate root: sections belong to an article and are read and written only through `ArticleRepository`. Do not introduce separate image or section repositories.
- [x] Preserve the repository signatures and use cases. Document that create and update persist the complete aggregate, with update replacing its editable state while preserving the article ID. Keep section IDs caller-supplied and preserve array order on round trips.
- [x] In PostgreSQL, store article fields in `articles`, with the image value object in one `image` JSONB column; store sections in `sections` with an article foreign key and explicit position. Define relational constraints and deterministic ordering. Keep sections relational so aggregate persistence demonstrates writes across tables.
- [x] Map the relational representation through MikroORM entities kept inside the adapter. Ensure section edits, additions, removals, and reordering persist correctly, including removal of sections no longer present in the aggregate.
- [x] Persist each PostgreSQL create or update in one transaction covering the article and all its sections. A failed write must leave no partial changes. Keep the missing-update behavior and allow infrastructure errors to propagate.
- [x] In OpenSearch, persist the whole aggregate in one document using one document write per create or update. Extend the explicit image and section mappings, retain the distinct persistence field names where appropriate, and preserve section array order. Keep reads by ID real-time and updates unable to upsert missing documents.
- [x] Extend shared contract tests to assert full aggregate equality after create and update. Cover image changes, section edits, additions, removals, reordering, and an empty section array. Preserve missing-ID and missing-update coverage and exercise the same application use cases with both adapters.
- [x] Add PostgreSQL-specific integration tests that cause a real section write to fail during create and update. Verify from fresh database reads that a failed create leaves no article or sections and a failed update preserves all previously stored article and section data. Do not rely on the ORM identity map or mock the failure.
- [x] Extend OpenSearch-specific tests to verify the actual aggregate mapping and that a rejected document replacement leaves the previously stored aggregate intact.
- [x] Run type checking and both suites against real containers. Verify rollback tests are deterministic and that section order survives reloads.

**Checkpoint:** both adapters persist complete aggregates; relational writes roll back together and OpenSearch replaces a single document atomically. Type checking and all 22 integration tests pass (12 PostgreSQL, 10 OpenSearch), including section ordering, removal, aggregate isolation, and persistence failure checks.

**Commit:** `feat: persist article aggregates atomically`

## 11. Document and verify the aggregate demo

- [x] Update `goal.md` to consolidate the agreed aggregate shape and MikroORM requirement into the main specification, replacing superseded flat-model examples and direct-SQL guidance.
- [x] Update the README's model, persistence mapping, project structure, and use-case example to show an article with an image and multiple sections, including MikroORM initialization where needed.
- [x] Explain the aggregate boundary: article and sections are saved together through one repository operation, with a PostgreSQL transaction across relational tables and a single OpenSearch document write.
- [x] Explain the rollback demonstration and distinguish atomic persistence from protection against concurrent overwrites. Leave version fields, locking strategies, conflict handling, and concurrent-editing tests for the later exercise.
- [x] Run type checking and both integration suites as the final regression check. Verify the Vitest UI page and JavaScript are served, rerun both adapters through its WebSocket API, and confirm container cleanup. Keep the existing runtime-neutral and Colima commands working.
- [x] Update this checklist with verified outcomes; keep local diagnostics in chat.

**Checkpoint:** documentation matches the implementation. Type checking and all 22 integration tests pass; Vitest UI assets and individual suite reruns through its API are verified, with no unhandled errors or leftover test containers.

**Commit:** `docs: explain aggregate boundaries and atomic persistence`

**Add-on completion criteria:** the domain and application remain independent of MikroORM; PostgreSQL uses relational aggregate storage; both adapters pass the shared aggregate contract; real-infrastructure tests demonstrate atomic persistence and rollback behavior; documentation explains the guarantees without introducing concurrency control.
