import { errors, type Client } from "@opensearch-project/opensearch";
import type { Article } from "../../../domain/Article.js";
import type { ArticleRepository } from "../../../application/ports/ArticleRepository.js";

type ArticleDocument = {
  headline: string;
  content: string;
  state: Article["status"];
};

function isMissingDocument(error: unknown): boolean {
  return (
    error instanceof errors.ResponseError &&
    error.statusCode === 404 &&
    (error.body.found === false ||
      error.body.error?.type === "document_missing_exception")
  );
}

export class OpenSearchArticleRepository implements ArticleRepository {
  private readonly client: Client;
  private readonly index: string;

  constructor(client: Client, index: string) {
    this.client = client;
    this.index = index;
  }

  async create(article: Article): Promise<void> {
    await this.client.create({
      index: this.index,
      id: article.id,
      body: {
        headline: article.title,
        content: article.content,
        state: article.status,
      },
    });
  }

  async findById(id: string): Promise<Article | null> {
    try {
      const { body } = await this.client.get({
        index: this.index,
        id,
        realtime: true,
      });
      const source: ArticleDocument = body._source;

      return {
        id: body._id,
        title: source.headline,
        content: source.content,
        status: source.state,
      };
    } catch (error) {
      if (isMissingDocument(error)) return null;
      throw error;
    }
  }

  async update(article: Article): Promise<boolean> {
    try {
      await this.client.update({
        index: this.index,
        id: article.id,
        body: {
          doc: {
            headline: article.title,
            content: article.content,
            state: article.status,
          },
          doc_as_upsert: false,
        },
      });
      return true;
    } catch (error) {
      if (isMissingDocument(error)) return false;
      throw error;
    }
  }
}
