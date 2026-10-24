import type { Article } from "../../domain/Article.js";

export interface ArticleRepository {
  /** Creates the complete aggregate atomically, using caller-supplied article and section IDs. */
  create(article: Article): Promise<void>;

  /** Returns the complete aggregate with sections in array order, or null if missing. */
  findById(id: string): Promise<Article | null>;

  /**
   * Atomically replaces the title, status, image, and ordered sections of article.id.
   * Sections belong to their article; their IDs are scoped to that aggregate.
   * Preserves the article ID and returns true if it existed; otherwise returns
   * false without creating an article. Persistence failures propagate as errors.
   */
  update(article: Article): Promise<boolean>;
}
