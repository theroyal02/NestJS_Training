import { ArticleAuthor } from '../../articles/interfaces/article-response.interface.js';

export interface CommentResponse {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  body: string;
  author: ArticleAuthor;
}

export interface SingleCommentResponse {
  comment: CommentResponse;
}

export interface MultipleCommentsResponse {
  comments: CommentResponse[];
}
