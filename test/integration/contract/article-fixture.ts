import { randomUUID } from "node:crypto";
import type { Article } from "../../../src/domain/Article.js";

export function draftArticle(): Article {
  return {
    id: randomUUID(),
    title: "Draft title",
    status: "draft",
    image: {
      url: "https://example.com/draft.jpg",
      alt: "Draft image",
    },
    // Deliberately not in alphabetical ID order; IDs are local to each article.
    sections: [
      { id: "intro", title: "Introduction", content: "Introduction content" },
      { id: "details", title: "Details", content: "Detailed content" },
      { id: "conclusion", title: "Conclusion", content: "Conclusion content" },
    ],
  };
}
