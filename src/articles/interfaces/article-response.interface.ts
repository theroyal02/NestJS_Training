export interface ArticleAuthor {
  username: string;
  bio: string | null;
  image: string | null;
  following: boolean;
}

export interface ArticleResponse {
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  createdAt: Date;
  updatedAt: Date;
  favorited: boolean;
  favoritesCount: number;
  author: ArticleAuthor;
}

export interface SingleArticleResponse {
  article: ArticleResponse;
}

export interface MultipleArticlesResponse {
  articles: ArticleResponse[];
  articlesCount: number;
}
