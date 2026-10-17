import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { PostgresArticleRepository } from "../../../src/adapters/outbound/postgres/PostgresArticleRepository.js";
import { articleRepositoryContract } from "../contract/article-repository.contract.js";

describe("PostgresArticleRepository", () => {
  let container: StartedPostgreSqlContainer | undefined;
  let pool: Pool;
  let repository: PostgresArticleRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17.11-alpine3.24").start();
    pool = new Pool({
      connectionString: container.getConnectionUri(),
      connectionTimeoutMillis: 5_000,
    });
    const schema = await readFile(
      new URL("../../../src/adapters/outbound/postgres/schema.sql", import.meta.url),
      "utf8",
    );
    await pool.query(schema);
    repository = new PostgresArticleRepository(pool);
  }, 180_000);

  afterAll(async () => {
    try {
      await pool?.end();
    } finally {
      await container?.stop();
    }
  }, 60_000);

  articleRepositoryContract(() => repository);

  test("rejects a publication status outside the allowed values", async () => {
    await expect(
      pool.query(
        `INSERT INTO articles (article_id, title, body, publication_status)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), "Invalid status", "Article content", "archived"],
      ),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "articles_publication_status_check",
    });
  });
});
