CREATE TABLE articles (
  article_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  publication_status TEXT NOT NULL,
  CONSTRAINT articles_publication_status_check
    CHECK (publication_status IN ('draft', 'published'))
);
