import type { Article } from "../../domain/Article.js";
import type { ArticleRepository } from "../ports/ArticleRepository.js";

export class CreateArticle {
  private readonly repository: ArticleRepository;

  constructor(repository: ArticleRepository) {
    this.repository = repository;
  }

  execute(article: Article): Promise<void> {
    return this.repository.create(article);
  }
}
