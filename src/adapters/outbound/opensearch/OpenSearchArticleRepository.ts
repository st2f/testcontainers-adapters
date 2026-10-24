import { errors, type Client } from "@opensearch-project/opensearch";
import type { Article } from "../../../domain/Article.js";
import type { ArticleRepository } from "../../../application/ports/ArticleRepository.js";

type ArticleDocument = {
  headline: string;
  state: Article["status"];
  image: Article["image"];
  sections: { id: string; headline: string; content: string }[];
};

function articleDocument(article: Article): ArticleDocument {
  return {
    headline: article.title,
    state: article.status,
    image: { ...article.image },
    sections: article.sections.map((section) => ({
      id: section.id,
      headline: section.title,
      content: section.content,
    })),
  };
}

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
      body: articleDocument(article),
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
        status: source.state,
        image: { ...source.image },
        sections: source.sections.map((section) => ({
          id: section.id,
          title: section.headline,
          content: section.content,
        })),
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
          // Replace the source rather than merging fields; no upsert is configured.
          script: {
            lang: "painless",
            source: "ctx._source = params.article",
            params: { article: articleDocument(article) },
          },
        },
      });
      return true;
    } catch (error) {
      if (isMissingDocument(error)) return false;
      throw error;
    }
  }
}
