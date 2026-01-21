import { z } from 'zod';

/**
 * Database schema definitions for runtime validation
 * These schemas validate data stored in the JSON database
 */

// Feed schema
export const FeedSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  url: z.string().url('Invalid feed URL'),
  created_at: z.string().datetime()
});

// Article schema
export const ArticleSchema = z.object({
  id: z.number().int().positive(),
  feed_id: z.number().int().positive(),
  title: z.string().min(1).max(500),
  link: z.string().url('Invalid article link'),
  content: z.string().optional(),
  description: z.string().optional(),
  pub_date: z.string().datetime(),
  image_url: z.string().url().optional(),
  is_read: z.boolean(),
  is_saved: z.boolean(),
  created_at: z.string().datetime()
});

// Article with feed title (for API responses)
export const ArticleWithFeedSchema = ArticleSchema.extend({
  feed_title: z.string()
});

// Settings schema
export const SettingSchema = z.object({
  key: z.string(),
  value: z.any()
});

// LLM Config schema
export const LLMConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'openrouter', 'ollama', 'custom']).optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().min(1).max(200).optional()
});

// Database schema (entire database structure)
export const DatabaseSchema = z.object({
  feeds: z.array(FeedSchema),
  articles: z.array(ArticleSchema),
  settings: z.record(z.string(), z.any()),
  nextFeedId: z.number().int().positive(),
  nextArticleId: z.number().int().positive()
});
