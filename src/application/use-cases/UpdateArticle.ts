import type { Article } from "../../domain/Article.js";
import type { ArticleRepository } from "../ports/ArticleRepository.js";

export class UpdateArticle {
  private readonly repository: ArticleRepository;

  constructor(repository: ArticleRepository) {
    this.repository = repository;
  }

  execute(article: Article): Promise<boolean> {
    return this.repository.update(article);
  }
}
