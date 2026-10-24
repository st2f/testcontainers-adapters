import { Cascade, defineEntity, p } from "@mikro-orm/core";
import type { Article } from "../../../domain/Article.js";
import { SectionEntity } from "./SectionEntity.js";

const ArticleSchema = defineEntity({
  name: "ArticleEntity",
  tableName: "articles",
  properties: {
    id: p.text().primary().fieldName("article_id"),
    title: p.text(),
    status: p.text().$type<Article["status"]>().fieldName("publication_status"),
    image: p.json<Article["image"]>().columnType("jsonb"),
    sections: () =>
      p.oneToMany(SectionEntity)
        .mappedBy("article")
        .cascade(Cascade.PERSIST)
        .orphanRemoval()
        .orderBy({ position: "asc" }),
  },
  checks: [
    {
      name: "articles_publication_status_check",
      expression: "publication_status IN ('draft', 'published')",
    },
  ],
});

export class ArticleEntity extends ArticleSchema.class {}

ArticleSchema.setClass(ArticleEntity);
