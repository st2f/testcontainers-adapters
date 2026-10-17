import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import type { Article } from "../../../src/domain/Article.js";
import type { ArticleRepository } from "../../../src/application/ports/ArticleRepository.js";
import { CreateArticle } from "../../../src/application/use-cases/CreateArticle.js";
import { UpdateArticle } from "../../../src/application/use-cases/UpdateArticle.js";

function draftArticle(): Article {
  return {
    id: randomUUID(),
    title: "Draft title",
    content: "Draft content",
    status: "draft",
  };
}

export function articleRepositoryContract(
  getRepository: () => ArticleRepository,
): void {
  describe("ArticleRepository contract", () => {
    test("creates an article and retrieves it by ID", async () => {
      const repository = getRepository();
      const article = draftArticle();

      await expect(new CreateArticle(repository).execute(article)).resolves.toBeUndefined();

      await expect(repository.findById(article.id)).resolves.toEqual(article);
    });

    test("updates all editable fields while preserving the ID", async () => {
      const repository = getRepository();
      const article = draftArticle();
      await new CreateArticle(repository).execute(article);

      const updated: Article = {
        ...article,
        title: "Published title",
        content: "Published content",
        status: "published",
      };
      await expect(new UpdateArticle(repository).execute(updated)).resolves.toBe(true);

      await expect(repository.findById(article.id)).resolves.toEqual(updated);
    });

    test("returns null for a missing ID", async () => {
      const repository = getRepository();

      await expect(repository.findById(randomUUID())).resolves.toBeNull();
    });

    test("returns false when updating a missing article without creating it", async () => {
      const repository = getRepository();
      const article = draftArticle();

      await expect(new UpdateArticle(repository).execute(article)).resolves.toBe(false);

      await expect(repository.findById(article.id)).resolves.toBeNull();
    });
  });
}
