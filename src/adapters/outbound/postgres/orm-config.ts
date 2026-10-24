import { defineConfig } from "@mikro-orm/postgresql";
import { PostgresArticleEntity } from "./PostgresArticleEntity.js";

export function postgresOrmConfig(clientUrl: string) {
  return defineConfig({
    clientUrl,
    entities: [PostgresArticleEntity],
    driverOptions: { connectionTimeoutMillis: 5_000 },
  });
}
