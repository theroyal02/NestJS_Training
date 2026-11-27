import { Article } from '../../database/entities/article.entity.js';
import { User } from '../../users/entities/user.entity.js';
import {
  ArticleAuthor,
  ArticleResponse,
} from '../interfaces/article-response.interface.js';

export function toAuthorResponse(user: User, following: boolean): ArticleAuthor {
  return {
    username: user.username,
    bio: user.bio ?? null,
    image: user.image ?? null,
    following,
  };
}

export function toArticleResponse(
  article: Article,
  meta: {
    favorited: boolean;
    favoritesCount: number;
    following: boolean;
    tagList?: string[];
  },
): ArticleResponse {
  const tagList =
    meta.tagList ??
    (article.articleTags || [])
      .map((at) => at.tag?.name)
      .filter((name): name is string => Boolean(name));

  return {
    slug: article.slug,
    title: article.title,
    description: article.description,
    body: article.body,
    tagList,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    favorited: meta.favorited,
    favoritesCount: meta.favoritesCount,
    author: toAuthorResponse(article.author, meta.following),
  };
}
