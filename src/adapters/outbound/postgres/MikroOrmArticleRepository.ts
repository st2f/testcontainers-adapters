import type { EntityManager } from "@mikro-orm/postgresql";
import type { Article } from "../../../domain/Article.js";
import type { ArticleRepository } from "../../../application/ports/ArticleRepository.js";
import { ArticleEntity } from "./ArticleEntity.js";
import { SectionEntity } from "./SectionEntity.js";

function articleFields(article: Article) {
  return {
    title: article.title,
    status: article.status,
    image: { ...article.image },
  };
}

export class MikroOrmArticleRepository implements ArticleRepository {
  constructor(private readonly entityManager: EntityManager) {}

  async create(article: Article): Promise<void> {
    await this.entityManager.fork().transactional(async (em) => {
      const entity = em.create(ArticleEntity, {
        id: article.id,
        ...articleFields(article),
        sections: [],
      });
      entity.sections.set(
        article.sections.map((section, position) =>
          em.create(SectionEntity, { ...section, position, article: entity }),
        ),
      );
      em.persist(entity);
      await em.flush();
    });
  }

  async findById(id: string): Promise<Article | null> {
    const em = this.entityManager.fork();
    const entity = await em.findOne(
      ArticleEntity,
      { id },
      { populate: ["sections"] },
    );

    return entity
      ? {
          id: entity.id,
          title: entity.title,
          status: entity.status,
          image: { ...entity.image },
          sections: entity.sections.getItems().map((section) => ({
            id: section.id,
            title: section.title,
            content: section.content,
          })),
        }
      : null;
  }

  async update(article: Article): Promise<boolean> {
    return this.entityManager.fork().transactional(async (em) => {
      const entity = await em.findOne(
        ArticleEntity,
        { id: article.id },
        { populate: ["sections"] },
      );
      if (!entity) return false;

      Object.assign(entity, articleFields(article));
      const existing = new Map(
        entity.sections.getItems().map((section) => [section.id, section]),
      );
      entity.sections.set(
        article.sections.map((section, position) => {
          const managed = existing.get(section.id);
          if (managed) {
            Object.assign(managed, {
              title: section.title,
              content: section.content,
              position,
            });
            return managed;
          }
          return em.create(SectionEntity, { ...section, position, article: entity });
        }),
      );

      // Persist the root to track scalar changes and cascade through its managed collection.
      em.persist(entity);
      await em.flush();
      return true;
    });
  }
}
