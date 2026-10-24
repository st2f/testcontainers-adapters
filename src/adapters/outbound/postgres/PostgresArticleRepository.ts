import type { EntityManager } from "@mikro-orm/postgresql";
import type { Article } from "../../../domain/Article.js";
import type { ArticleRepository } from "../../../application/ports/ArticleRepository.js";
import { PostgresArticleEntity } from "./PostgresArticleEntity.js";

export class PostgresArticleRepository implements ArticleRepository {
  constructor(private readonly entityManager: EntityManager) {}

  async create(article: Article): Promise<void> {
    const em = this.entityManager.fork();
    const entity = em.create(PostgresArticleEntity, {
      id: article.id,
      title: article.title,
      content: article.content,
      status: article.status,
    });
    em.persist(entity);
    await em.flush();
  }

  async findById(id: string): Promise<Article | null> {
    const em = this.entityManager.fork();
    const entity = await em.findOne(PostgresArticleEntity, { id });

    return entity
      ? {
          id: entity.id,
          title: entity.title,
          content: entity.content,
          status: entity.status,
        }
      : null;
  }

  async update(article: Article): Promise<boolean> {
    const em = this.entityManager.fork();
    const affected = await em.nativeUpdate(
      PostgresArticleEntity,
      { id: article.id },
      { title: article.title, content: article.content, status: article.status },
    );

    return affected === 1;
  }
}
