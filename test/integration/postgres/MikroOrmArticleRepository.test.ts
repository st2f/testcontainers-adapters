import { randomUUID } from "node:crypto";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { MikroORM } from "@mikro-orm/postgresql";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { MikroOrmArticleRepository } from "../../../src/adapters/outbound/postgres/MikroOrmArticleRepository.js";
import { postgresOrmConfig } from "../../../src/adapters/outbound/postgres/orm-config.js";
import { articleRepositoryContract } from "../contract/article-repository.contract.js";
import { draftArticle } from "../contract/article-fixture.js";

describe("MikroOrmArticleRepository", () => {
  let container: StartedPostgreSqlContainer | undefined;
  let orm: MikroORM | undefined;
  let repository: MikroOrmArticleRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17.11-alpine3.24").start();
    // Assign before connecting so cleanup can close even a partially initialized ORM.
    orm = new MikroORM(postgresOrmConfig(container.getConnectionUri()));
    await orm.schema.create();
    // A test-only constraint injects a genuine database failure during section writes.
    await orm.em.fork().execute(`ALTER TABLE article_sections
      ADD CONSTRAINT integration_test_rejected_body
      CHECK (body <> '__reject_section_write__')`);
    repository = new MikroOrmArticleRepository(orm.em);
  }, 180_000);

  afterAll(async () => {
    try {
      await orm?.close(true);
    } finally {
      await container?.stop();
    }
  }, 60_000);

  articleRepositoryContract(() => repository);

  async function storedRows(id: string) {
    const em = orm!.em.fork();
    return {
      articles: await em.execute("SELECT * FROM articles WHERE article_id = ?", [id]),
      sections: await em.execute(
        "SELECT * FROM article_sections WHERE article_id = ? ORDER BY position", [id],
      ),
    };
  }

  test("rejects a publication status outside the allowed values", async () => {
    const article = draftArticle();
    await repository.create(article);
    await expect(
      orm!.em.fork().execute(
        "UPDATE articles SET publication_status = ? WHERE article_id = ?",
        ["archived", article.id],
      ),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "articles_publication_status_check",
    });
  });

  test("reads database changes without reusing a cached entity", async () => {
    const article = draftArticle();
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
    const article = draftArticle();
    await repository.create(article);

    await expect(repository.create({ ...article, title: "Duplicate" })).rejects.toMatchObject({
      code: "23505",
    });
    await expect(repository.findById(article.id)).resolves.toEqual(article);

    const nextArticle = { ...article, id: randomUUID() };
    await repository.create(nextArticle);
    await expect(repository.findById(nextArticle.id)).resolves.toEqual(nextArticle);
  });

  test("rolls back the article and all sections when a section insert fails", async () => {
    const article = draftArticle();
    article.sections[1]!.content = "__reject_section_write__";

    await expect(repository.create(article)).rejects.toMatchObject({
      code: "23514",
      constraint: "integration_test_rejected_body",
    });

    // Direct SQL on a fresh manager proves there is no partially stored aggregate.
    await expect(storedRows(article.id)).resolves.toEqual({ articles: [], sections: [] });
    await expect(repository.findById(article.id)).resolves.toBeNull();
  });

  test("rolls back article changes and section inserts, edits, and removals when a section update fails", async () => {
    const article = draftArticle();
    await repository.create(article);
    const before = await storedRows(article.id);
    const replacement = {
      ...article,
      title: "Replacement title",
      status: "published" as const,
      image: { url: "https://example.com/replacement.jpg", alt: "Replacement image" },
      sections: [
        { id: "new-section", title: "New section", content: "New content" },
        { ...article.sections[0]!, content: "__reject_section_write__" },
        article.sections[2]!,
      ],
    };

    await expect(repository.update(replacement)).rejects.toMatchObject({
      code: "23514",
      constraint: "integration_test_rejected_body",
    });
    await expect(storedRows(article.id)).resolves.toEqual(before);
    await expect(repository.findById(article.id)).resolves.toEqual(article);

    replacement.sections[1]!.content = "Valid replacement content";
    await expect(repository.update(replacement)).resolves.toBe(true);
    await expect(repository.findById(article.id)).resolves.toEqual(replacement);
  });
});
