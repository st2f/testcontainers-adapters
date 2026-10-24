import { EntitySchema, PrimaryKeyProp } from "@mikro-orm/core";
import { ArticleEntity } from "./ArticleEntity.js";

export class SectionEntity {
  article!: ArticleEntity;
  id!: string;
  title!: string;
  content!: string;
  position!: number;
  [PrimaryKeyProp]?: ["article", "id"];
}

// A class with an explicit schema keeps the bidirectional relation's types simple.
export const sectionSchema = new EntitySchema<SectionEntity>({
  class: SectionEntity,
  tableName: "sections",
  properties: {
    article: {
      kind: "m:1",
      entity: () => ArticleEntity,
      fieldName: "article_id",
      primary: true,
      inversedBy: "sections",
      deleteRule: "cascade",
    },
    id: { type: "text", fieldName: "section_id", primary: true },
    title: { type: "text" },
    content: { type: "text", fieldName: "body" },
    position: { type: "integer" },
  },
  checks: [
    { name: "sections_position_check", expression: "position >= 0" },
  ],
});
