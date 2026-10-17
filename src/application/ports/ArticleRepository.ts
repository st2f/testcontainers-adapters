import type { Article } from "../../domain/Article.js";

export interface ArticleRepository {
  /** Creates an article using its caller-supplied ID. */
  create(article: Article): Promise<void>;

  /** Returns the article, or null when the ID does not exist. */
  findById(id: string): Promise<Article | null>;

  /**
   * Replaces the title, content, and status of the article identified by article.id.
   * Preserves its ID and returns true if it existed; otherwise returns false
   * without creating an article.
   */
  update(article: Article): Promise<boolean>;
}
