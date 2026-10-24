import { defineConfig } from "@mikro-orm/postgresql";
import { ArticleEntity } from "./ArticleEntity.js";
import { sectionSchema } from "./SectionEntity.js";

export function postgresOrmConfig(clientUrl: string) {
  return defineConfig({
    clientUrl,
    entities: [ArticleEntity, sectionSchema],
    // Register the aggregate root explicitly; its sections participate through cascade persist.
    persistOnCreate: false,
    driverOptions: { connectionTimeoutMillis: 5_000 },
  });
}
