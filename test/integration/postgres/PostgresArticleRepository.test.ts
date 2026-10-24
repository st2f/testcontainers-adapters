import { randomUUID } from "node:crypto";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { MikroORM } from "@mikro-orm/postgresql";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { PostgresArticleRepository } from "../../../src/adapters/outbound/postgres/PostgresArticleRepository.js";
import { postgresOrmConfig } from "../../../src/adapters/outbound/postgres/orm-config.js";
import { articleRepositoryContract } from "../contract/article-repository.contract.js";

describe("PostgresArticleRepository", () => {
  let container: StartedPostgreSqlContainer | undefined;
  let orm: MikroORM | undefined;
  let repository: PostgresArticleRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17.11-alpine3.24").start();
    // Assign before connecting so cleanup can close even a partially initialized ORM.
    orm = new MikroORM(postgresOrmConfig(container.getConnectionUri()));
    await orm.schema.create();
    repository = new PostgresArticleRepository(orm.em);
  }, 180_000);

  afterAll(async () => {
    try {
      await orm?.close(true);
    } finally {
      await container?.stop();
    }
  }, 60_000);

  articleRepositoryContract(() => repository);

  test("rejects a publication status outside the allowed values", async () => {
    await expect(
      orm!.em.fork().execute(
        `INSERT INTO articles (article_id, title, body, publication_status)
         VALUES (?, ?, ?, ?)`,
        [randomUUID(), "Invalid status", "Article content", "archived"],
      ),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "articles_publication_status_check",
    });
  });

  test("reads database changes without reusing a cached entity", async () => {
    const article = {
      id: randomUUID(),
      title: "Original title",
      content: "Article content",
      status: "draft" as const,
    };
    await repository.create(article);
    await expect(repository.findById(article.id)).resolves.toEqual(article);

    await orm!.em.fork().execute(
      "UPDATE articles SET title = ? WHERE article_id = ?",
      ["Changed outside the repository", article.id],
    );

    await expect(repository.findById(article.id)).resolves.toEqual({
      ...article,
      title: "Changed outside the repository",
    });
  });

  test("rejects duplicate creation and remains usable after the failed write", async () => {
    const article = {
      id: randomUUID(),
      title: "Original title",
      content: "Article content",
      status: "draft" as const,
    };
    await repository.create(article);

    await expect(repository.create({ ...article, title: "Duplicate" })).rejects.toMatchObject({
      code: "23505",
    });
    await expect(repository.findById(article.id)).resolves.toEqual(article);

    const nextArticle = { ...article, id: randomUUID() };
    await repository.create(nextArticle);
    await expect(repository.findById(nextArticle.id)).resolves.toEqual(nextArticle);
  });
});
