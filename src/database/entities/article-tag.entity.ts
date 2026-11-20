import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Article } from './article.entity.js';
import { Tag } from './tag.entity.js';

@Entity('article_tags')
@Index('IDX_ARTICLE_TAGS_TAG_ID', ['tagId'])
export class ArticleTag {
  @PrimaryColumn({ name: 'article_id', type: 'int' })
  articleId: number;

  @PrimaryColumn({ name: 'tag_id', type: 'int' })
  tagId: number;

  @ManyToOne(() => Article, (article) => article.articleTags, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'article_id' })
  article: Article;

  @ManyToOne(() => Tag, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id' })
  tag: Tag;
}
