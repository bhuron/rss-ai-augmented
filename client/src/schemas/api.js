import { z } from 'zod';

/**
 * Client-side API response validation schemas
 * These schemas validate data returned from the server API
 */

// ============================================
// SHARED SCHEMAS
// ============================================

// Feed schema
const FeedSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  url: z.string().url(),
  created_at: z.string().datetime()
});

// Article schema
const ArticleSchema = z.object({
  id: z.number().int().positive(),
  feed_id: z.number().int().positive(),
  title: z.string().min(1).max(500),
  link: z.string().url(),
  content: z.string().optional(),
  description: z.string().optional(),
  pub_date: z.string().datetime(),
  image_url: z.string().url().optional(),
  is_read: z.boolean(),
  is_saved: z.boolean(),
  created_at: z.string().datetime(),
  feed_title: z.string()
});

// ============================================
// API RESPONSE SCHEMAS
// ============================================

// GET /api/feeds
export const GetFeedsResponseSchema = z.array(FeedSchema);

// POST /api/feeds
export const AddFeedResponseSchema = FeedSchema;

// GET /api/articles
export const GetArticlesResponseSchema = z.array(ArticleSchema);

// POST /api/ai/sort
export const AISortResponseSchema = z.object({
  sortedArticles: z.array(z.object({
    article: ArticleSchema,
    category: z.string(),
    relevanceScore: z.number().optional()
  })),
  categories: z.array(z.string())
});

// POST /api/ai/digest
export const AIDigestResponseSchema = z.object({
  digest: z.string()
});

// GET /api/settings/llm
export const GetLLMSettingsResponseSchema = z.object({
  provider: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional()
});

// Sync result (for individual feed sync)
export const SyncResultSchema = z.object({
  added: z.number(),
  updated: z.number()
});

// Sync progress (for sync-all SSE streaming)
export const SyncProgressSchema = z.object({
  type: z.enum(['progress', 'complete']),
  synced: z.number(),
  failed: z.number(),
  completed: z.number().optional(),
  total: z.number()
});

// Import result
export const ImportResultSchema = z.object({
  imported: z.number(),
  failed: z.number(),
  blocked: z.number(),
  total: z.number()
});

// Generic success response
export const SuccessResponseSchema = z.object({
  success: z.boolean()
});

// Error response
export const ErrorResponseSchema = z.object({
  error: z.string()
});

// ============================================
// REQUEST SCHEMAS (for validation before sending)
// ============================================

// POST /api/feeds
export const AddFeedRequestSchema = z.object({
  url: z.string().url('Invalid feed URL')
});

// PATCH /api/feeds/:id
export const RenameFeedRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long')
});

// PATCH /api/articles/:id/read
export const UpdateReadStatusRequestSchema = z.object({
  isRead: z.boolean()
});

// PATCH /api/articles/:id/saved
export const UpdateSavedStatusRequestSchema = z.object({
  isSaved: z.boolean()
});

// POST /api/ai/sort
export const AISortRequestSchema = z.object({
  articleIds: z.array(z.number().int().positive()).max(100, 'Cannot sort more than 100 articles'),
  criteria: z.string().min(1).max(200).optional()
});

// POST /api/ai/digest
export const AIDigestRequestSchema = z.object({
  articleIds: z.array(z.number().int().positive()).max(100, 'Cannot digest more than 100 articles')
});

// POST /api/settings/llm
export const UpdateLLMSettingsRequestSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'openrouter', 'ollama', 'custom']).optional(),
  apiKey: z.string().max(500).optional(),
  baseUrl: z.string().url().optional().or(z.literal('')),
  model: z.string().min(1).max(200).optional()
});

// POST /api/feeds/import
export const ImportOPMLRequestSchema = z.object({
  opml: z.string().min(1, 'OPML data is required')
});
