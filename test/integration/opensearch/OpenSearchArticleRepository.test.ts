import { randomUUID } from "node:crypto";
import { Client } from "@opensearch-project/opensearch";
import {
  OpenSearchContainer,
  type StartedOpenSearchContainer,
} from "@testcontainers/opensearch";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { OpenSearchArticleRepository } from "../../../src/adapters/outbound/opensearch/OpenSearchArticleRepository.js";
import { createArticleIndex } from "../../../src/adapters/outbound/opensearch/index-setup.js";
import { articleRepositoryContract } from "../contract/article-repository.contract.js";

describe("OpenSearchArticleRepository", () => {
  const index = "articles";
  let container: StartedOpenSearchContainer | undefined;
  let client: Client;
  let repository: OpenSearchArticleRepository;

  beforeAll(async () => {
    container = await new OpenSearchContainer("opensearchproject/opensearch:3.9.0")
      .withSecurityEnabled(false)
      .withEnvironment({
        DISABLE_INSTALL_DEMO_CONFIG: "true",
        OPENSEARCH_JAVA_OPTS: "-Xms512m -Xmx512m",
        "action.auto_create_index": "false",
      })
      .start();
    client = new Client({ node: container.getHttpUrl() });
    await createArticleIndex(client, index);
    repository = new OpenSearchArticleRepository(client, index);
  }, 180_000);

  afterAll(async () => {
    try {
      await client?.close();
    } finally {
      await container?.stop();
    }
  }, 60_000);

  articleRepositoryContract(() => repository);

  test("uses an explicit strict article mapping", async () => {
    const { body } = await client.indices.getMapping({ index });

    expect(body[index]?.mappings).toEqual({
      dynamic: "strict",
      properties: {
        headline: { type: "text" },
        content: { type: "text" },
        state: { type: "keyword" },
      },
    });
  });

  test("propagates missing-index errors for reads and updates", async () => {
    const missingIndexRepository = new OpenSearchArticleRepository(
      client,
      `missing-${randomUUID()}`,
    );
    const article = {
      id: randomUUID(),
      title: "Draft title",
      content: "Draft content",
      status: "draft" as const,
    };
    const missingIndexError = {
      statusCode: 404,
      body: { error: { type: "index_not_found_exception" } },
    };

    await expect(missingIndexRepository.findById(article.id)).rejects.toMatchObject(
      missingIndexError,
    );
    await expect(missingIndexRepository.update(article)).rejects.toMatchObject(
      missingIndexError,
    );
  });
});
