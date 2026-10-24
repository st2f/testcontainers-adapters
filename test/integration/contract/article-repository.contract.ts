import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import type { Article } from "../../../src/domain/Article.js";
import type { ArticleRepository } from "../../../src/application/ports/ArticleRepository.js";
import { CreateArticle } from "../../../src/application/use-cases/CreateArticle.js";
import { UpdateArticle } from "../../../src/application/use-cases/UpdateArticle.js";
import { draftArticle } from "./article-fixture.js";

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
        status: "published",
        image: {
          url: "https://example.com/published.jpg",
          alt: "Published image",
        },
        sections: article.sections.map((section) => ({
          ...section,
          title: `Edited ${section.title}`,
          content: `Edited ${section.content}`,
        })),
      };
      await expect(new UpdateArticle(repository).execute(updated)).resolves.toBe(true);

      await expect(repository.findById(article.id)).resolves.toEqual(updated);
    });

    test("returns null for a missing ID", async () => {
      const repository = getRepository();

      await expect(repository.findById(randomUUID())).resolves.toBeNull();
    });

    test("adds, removes, and reorders sections while retaining their IDs", async () => {
      const repository = getRepository();
      const article = draftArticle();
      await new CreateArticle(repository).execute(article);

      const updated: Article = {
        ...article,
        sections: [
          article.sections[2]!,
          { id: "new-section", title: "New section", content: "New content" },
          { ...article.sections[0]!, content: "Revised introduction" },
        ],
      };
      await expect(new UpdateArticle(repository).execute(updated)).resolves.toBe(true);
      await expect(repository.findById(article.id)).resolves.toEqual(updated);

      const reordered = { ...updated, sections: [...updated.sections].reverse() };
      await expect(new UpdateArticle(repository).execute(reordered)).resolves.toBe(true);
      await expect(repository.findById(article.id)).resolves.toEqual(reordered);
    });

    test("persists an empty section array on create and after removing all sections", async () => {
      const repository = getRepository();
      const empty: Article = { ...draftArticle(), sections: [] };
      await new CreateArticle(repository).execute(empty);
      await expect(repository.findById(empty.id)).resolves.toEqual(empty);

      const populated = { ...empty, sections: draftArticle().sections };
      await expect(new UpdateArticle(repository).execute(populated)).resolves.toBe(true);
      await expect(repository.findById(empty.id)).resolves.toEqual(populated);

      await expect(new UpdateArticle(repository).execute(empty)).resolves.toBe(true);
      await expect(repository.findById(empty.id)).resolves.toEqual(empty);
    });

    test("keeps articles with the same local section IDs independent", async () => {
      const repository = getRepository();
      const first = draftArticle();
      const second = draftArticle();
      await new CreateArticle(repository).execute(first);
      await new CreateArticle(repository).execute(second);

      await new UpdateArticle(repository).execute({ ...first, sections: [] });
      await expect(repository.findById(second.id)).resolves.toEqual(second);
    });

    test("returns false when updating a missing article without creating it", async () => {
      const repository = getRepository();
      const article = draftArticle();

      await expect(new UpdateArticle(repository).execute(article)).resolves.toBe(false);

      await expect(repository.findById(article.id)).resolves.toBeNull();
    });
  });
}
