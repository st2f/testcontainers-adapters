import type { Client } from "@opensearch-project/opensearch";

export async function createArticleIndex(
  client: Client,
  index: string,
): Promise<void> {
  await client.indices.create({
    index,
    body: {
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
      },
      mappings: {
        dynamic: "strict",
        properties: {
          headline: { type: "text" },
          state: { type: "keyword" },
          image: {
            type: "object",
            properties: {
              url: { type: "keyword" },
              alt: { type: "text" },
            },
          },
          sections: {
            type: "object",
            properties: {
              id: { type: "keyword" },
              headline: { type: "text" },
              content: { type: "text" },
            },
          },
        },
      },
    },
  });
}
