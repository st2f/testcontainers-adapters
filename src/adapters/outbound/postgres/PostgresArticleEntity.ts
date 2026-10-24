import { defineEntity, p } from "@mikro-orm/core";
import type { Article } from "../../../domain/Article.js";

const PostgresArticleSchema = defineEntity({
  name: "PostgresArticleEntity",
  tableName: "articles",
  properties: {
    id: p.text().primary().fieldName("article_id"),
    title: p.text(),
    content: p.text().fieldName("body"),
    status: p.text().$type<Article["status"]>().fieldName("publication_status"),
  },
  checks: [
    {
      name: "articles_publication_status_check",
      expression: "publication_status IN ('draft', 'published')",
    },
  ],
});

export class PostgresArticleEntity extends PostgresArticleSchema.class {}

PostgresArticleSchema.setClass(PostgresArticleEntity);
