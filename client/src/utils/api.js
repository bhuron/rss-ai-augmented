import {
  GetFeedsResponseSchema,
  GetArticlesResponseSchema,
  AISortResponseSchema,
  AIDigestResponseSchema,
  GetLLMSettingsResponseSchema,
  SyncResultSchema,
  SyncProgressSchema,
  ImportResultSchema,
  SuccessResponseSchema,
  AddFeedRequestSchema,
  RenameFeedRequestSchema,
  UpdateReadStatusRequestSchema,
  UpdateSavedStatusRequestSchema,
  AISortRequestSchema,
  AIDigestRequestSchema,
  UpdateLLMSettingsRequestSchema,
  ImportOPMLRequestSchema
} from '../schemas/api.js';

/**
 * Custom error class for API errors
 */
export class APIError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Validate response data against a Zod schema
 * Throws APIError if validation fails
 */
function validateResponse(data, schema, endpoint) {
  try {
    return schema.parse(data);
  } catch (error) {
    console.error(`Validation failed for ${endpoint}:`, error.errors);
    throw new APIError(
      `Invalid response from server: ${error.errors[0]?.message || 'Unknown error'}`,
      500,
      error.errors
    );
  }
}

/**
 * Handle API response, checking for errors and validating data
 */
async function handleAPIResponse(response, schema, endpoint) {
  if (!response.ok) {
    let errorMessage = 'Request failed';
    try {
      const data = await response.json();
      errorMessage = data.error || errorMessage;
    } catch {
      // Use default error message if JSON parsing fails
    }
    throw new APIError(errorMessage, response.status);
  }

  const data = await response.json();
  return schema ? validateResponse(data, schema, endpoint) : data;
}

/**
 * Validated API client
 * All methods validate requests before sending and validate responses after receiving
 */
export const api = {
  // ============================================
  // FEEDS
  // ============================================

  /**
   * Get all feeds
   */
  async getFeeds() {
    const response = await fetch('/api/feeds');
    return handleAPIResponse(response, GetFeedsResponseSchema, 'GET /api/feeds');
  },

  /**
   * Add a new feed
   */
  async addFeed(url) {
    // Validate request
    const validatedData = AddFeedRequestSchema.parse({ url });

    const response = await fetch('/api/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedData)
    });

    // Response uses the same schema as getFeeds
    return handleAPIResponse(response, GetFeedsResponseSchema, 'POST /api/feeds');
  },

  /**
   * Delete a feed
   */
  async deleteFeed(id) {
    const response = await fetch(`/api/feeds/${id}`, {
      method: 'DELETE'
    });
    return handleAPIResponse(response, SuccessResponseSchema, `DELETE /api/feeds/${id}`);
  },

  /**
   * Rename a feed
   */
  async renameFeed(id, title) {
    // Validate request
    const validatedData = RenameFeedRequestSchema.parse({ title });

    const response = await fetch(`/api/feeds/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedData)
    });

    return handleAPIResponse(response, SuccessResponseSchema, `PATCH /api/feeds/${id}`);
  },

  /**
   * Sync a single feed
   */
  async syncFeed(id) {
    const response = await fetch(`/api/feeds/${id}/sync`, {
      method: 'POST'
    });
    return handleAPIResponse(response, SyncResultSchema, `POST /api/feeds/${id}/sync`);
  },

  /**
   * Sync all feeds with progress streaming
   * Returns an async iterator that yields progress updates
   */
  async syncAllFeeds() {
    const response = await fetch('/api/feeds/sync-all', {
      method: 'POST'
    });

    if (!response.ok) {
      throw new APIError('Failed to start sync', response.status);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    return {
      async *[Symbol.asyncIterator]() {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                const validated = SyncProgressSchema.parse(data);
                yield validated;

                if (validated.type === 'complete') {
                  return;
                }
              } catch (error) {
                console.error('Failed to parse sync progress:', error);
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
    };
  },

  /**
   * Export feeds as OPML
   */
  async exportFeeds() {
    const response = await fetch('/api/feeds/export');
    if (!response.ok) {
      throw new APIError('Failed to export feeds', response.status);
    }
    return response.text();
  },

  /**
   * Import feeds from OPML
   */
  async importFeeds(opml) {
    // Validate request
    const validatedData = ImportOPMLRequestSchema.parse({ opml });

    const response = await fetch('/api/feeds/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedData)
    });

    return handleAPIResponse(response, ImportResultSchema, 'POST /api/feeds/import');
  },

  // ============================================
  // ARTICLES
  // ============================================

  /**
   * Get articles with optional filters
   */
  async getArticles({ feedId, unreadOnly } = {}) {
    const params = new URLSearchParams();
    if (feedId) params.append('feedId', feedId.toString());
    if (unreadOnly) params.append('unreadOnly', 'true');

    const response = await fetch(`/api/articles?${params}`);
    return handleAPIResponse(response, GetArticlesResponseSchema, 'GET /api/articles');
  },

  /**
   * Update article read status
   */
  async updateReadStatus(id, isRead) {
    // Validate request
    const validatedData = UpdateReadStatusRequestSchema.parse({ isRead });

    const response = await fetch(`/api/articles/${id}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedData)
    });

    return handleAPIResponse(response, SuccessResponseSchema, `PATCH /api/articles/${id}/read`);
  },

  /**
   * Update article saved status
   */
  async updateSavedStatus(id, isSaved) {
    // Validate request
    const validatedData = UpdateSavedStatusRequestSchema.parse({ isSaved });

    const response = await fetch(`/api/articles/${id}/saved`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedData)
    });

    return handleAPIResponse(response, SuccessResponseSchema, `PATCH /api/articles/${id}/saved`);
  },

  // ============================================
  // AI
  // ============================================

  /**
   * Sort articles using AI
   */
  async sortArticles(articleIds, criteria) {
    // Validate request
    const validatedData = AISortRequestSchema.parse({ articleIds, criteria });

    const response = await fetch('/api/ai/sort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedData)
    });

    return handleAPIResponse(response, AISortResponseSchema, 'POST /api/ai/sort');
  },

  /**
   * Generate AI digest
   */
  async generateDigest(articleIds) {
    // Validate request
    const validatedData = AIDigestRequestSchema.parse({ articleIds });

    const response = await fetch('/api/ai/digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedData)
    });

    return handleAPIResponse(response, AIDigestResponseSchema, 'POST /api/ai/digest');
  },

  // ============================================
  // SETTINGS
  // ============================================

  /**
   * Get LLM settings
   */
  async getLLMSettings() {
    const response = await fetch('/api/settings/llm');
    return handleAPIResponse(response, GetLLMSettingsResponseSchema, 'GET /api/settings/llm');
  },

  /**
   * Update LLM settings
   */
  async updateLLMSettings(settings) {
    // Validate request
    const validatedData = UpdateLLMSettingsRequestSchema.parse(settings);

    const response = await fetch('/api/settings/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedData)
    });

    return handleAPIResponse(response, SuccessResponseSchema, 'POST /api/settings/llm');
  }
};

export default api;
