import type { Pool } from "pg";
import type { Article } from "../../../domain/Article.js";
import type { ArticleRepository } from "../../../application/ports/ArticleRepository.js";

type ArticleRow = {
  article_id: string;
  title: string;
  body: string;
  publication_status: Article["status"];
};

export class PostgresArticleRepository implements ArticleRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async create(article: Article): Promise<void> {
    await this.pool.query(
      `INSERT INTO articles (article_id, title, body, publication_status)
       VALUES ($1, $2, $3, $4)`,
      [article.id, article.title, article.content, article.status],
    );
  }

  async findById(id: string): Promise<Article | null> {
    const result = await this.pool.query<ArticleRow>(
      `SELECT article_id, title, body, publication_status
       FROM articles WHERE article_id = $1`,
      [id],
    );
    const row = result.rows[0];

    return row
      ? {
          id: row.article_id,
          title: row.title,
          content: row.body,
          status: row.publication_status,
        }
      : null;
  }

  async update(article: Article): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE articles
       SET title = $2, body = $3, publication_status = $4
       WHERE article_id = $1`,
      [article.id, article.title, article.content, article.status],
    );

    return result.rowCount === 1;
  }
}
