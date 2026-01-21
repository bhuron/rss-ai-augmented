import { z } from 'zod';
import { FeedSchema, ArticleWithFeedSchema, LLMConfigSchema } from './database.js';

/**
 * API request/response validation schemas
 * These schemas validate HTTP request bodies and responses
 */

// ============================================
// FEED ROUTES
// ============================================

// POST /api/feeds - Add feed
export const AddFeedRequestSchema = z.object({
  url: z.string().url('Invalid feed URL')
});

// PATCH /api/feeds/:id - Rename feed
export const RenameFeedRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long')
});

// POST /api/feeds/import - Import OPML
export const ImportOPMLRequestSchema = z.object({
  opml: z.string().min(1, 'OPML data is required')
});

// ============================================
// ARTICLE ROUTES
// ============================================

// PATCH /api/articles/:id/read - Mark read/unread
export const UpdateReadStatusRequestSchema = z.object({
  isRead: z.boolean()
});

// PATCH /api/articles/:id/saved - Mark saved/unsaved
export const UpdateSavedStatusRequestSchema = z.object({
  isSaved: z.boolean()
});

// ============================================
// AI ROUTES
// ============================================

// POST /api/ai/sort - AI sort articles
export const AISortRequestSchema = z.object({
  articleIds: z.array(z.number().int().positive()).max(100, 'Cannot sort more than 100 articles'),
  criteria: z.string().min(1).max(200).optional()
});

// POST /api/ai/digest - Generate AI digest
export const AIDigestRequestSchema = z.object({
  articleIds: z.array(z.number().int().positive()).max(100, 'Cannot digest more than 100 articles')
});

// ============================================
// SETTINGS ROUTES
// ============================================

// POST /api/settings/llm - Update LLM settings
export const UpdateLLMSettingsRequestSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'openrouter', 'ollama', 'custom']).optional(),
  apiKey: z.string().max(500, 'API key too long').optional(),
  baseUrl: z.string().url('Invalid base URL').optional().or(z.literal('')),
  model: z.string().min(1).max(200).optional()
});

// ============================================
// RESPONSE SCHEMAS
// ============================================

// GET /api/feeds
export const GetFeedsResponseSchema = z.array(FeedSchema);

// GET /api/articles
export const GetArticlesResponseSchema = z.array(ArticleWithFeedSchema);

// POST /api/ai/sort
export const AISortResponseSchema = z.object({
  sortedArticles: z.array(z.object({
    article: ArticleWithFeedSchema,
    category: z.string(),
    relevanceScore: z.number().optional()
  })),
  categories: z.array(z.string())
});

// POST /api/ai/digest
export const AIDigestResponseSchema = z.object({
  digest: z.string()
});

// Sync result schema
export const SyncResultSchema = z.object({
  added: z.number(),
  updated: z.number()
});

// Sync progress schema (for SSE streaming)
export const SyncProgressSchema = z.object({
  type: z.enum(['progress', 'complete']),
  synced: z.number(),
  failed: z.number(),
  completed: z.number().optional(),
  total: z.number()
});

// Error response schema
export const ErrorResponseSchema = z.object({
  error: z.string()
});

// Success response schema
export const SuccessResponseSchema = z.object({
  success: z.boolean()
});

// Import result schema
export const ImportResultSchema = z.object({
  imported: z.number(),
  failed: z.number(),
  blocked: z.number(),
  total: z.number()
});

// LLM settings response schema (with masked API key)
export const LLMSettingsResponseSchema = z.object({
  provider: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional()
});
