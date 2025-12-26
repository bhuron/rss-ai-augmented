# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Start Development Servers
```bash
# Terminal 1 - Backend (port 3000)
cd server && npm install && npm run dev

# Terminal 2 - Frontend (port 5173)
cd client && npm install && npm run dev
```

### Production Build
```bash
# Frontend only
cd client && npm run build
```

### Run Server in Production
```bash
cd server && npm start
```

## Architecture Overview

This is a **full-stack RSS reader with AI-powered sorting**. The architecture is straightforward:

- **Client**: React 18 + Vite (port 5173 in dev)
- **Server**: Node.js + Express (port 3000)
- **Database**: Simple JSON file (`server/database.json`)
- **AI**: Provider-agnostic LLM integration (OpenAI, Anthropic, OpenRouter, Ollama, custom)

The client proxies all `/api` requests to the backend via Vite's proxy configuration.

## Key Architectural Patterns

### File-Based Database
The server uses `database.json` for persistence. The database module (`server/src/services/database.js`) provides in-memory operations with automatic saving. Key points:

- Articles are auto-cleaned based on retention policy (30 days read, 60 days unread, saved forever)
- Top 200 articles per feed are always kept to prevent re-syncing
- Duplicate detection uses URL normalization (removes tracking parameters)
- All database operations go through `articleOps` and `feedOps`

### LLM Integration
The AI service (`server/src/services/ai.js`) is provider-agnostic. Configuration is stored in the database with `llm_` prefix settings:

- `llm_provider`, `llm_apiKey`, `llm_model`, `llm baseUrl`
- No API keys in environment variables - all configured via web UI
- Article sanitization removes control characters and non-ASCII to prevent JSON encoding issues
- Fallback handling: if AI sorting fails, returns original order with generic category

### RSS Processing
Enhanced RSS parser (`server/src/services/rss.js`) with special handling:

- **YouTube feeds**: Auto-extract thumbnails, clean descriptions, optional Shorts filtering
- **Encoding detection**: Handles international character sets
- **Streaming sync**: Parallel feed processing with progress updates (15s timeout per feed)
- **Image proxy**: `/api/image-proxy` bypasses CORS/hotlink protection

### API Routes Structure
```
/api/feeds/       - Feed management (CRUD + sync + OPML import/export)
/api/articles/    - Article listing with filters, read/saved status updates
/api/ai/          - AI sorting and digest generation
/api/settings/    - LLM provider configuration
/api/image-proxy  - Image proxy for CORS bypass
```

### Client Components
```
ArticleList.jsx   - Main article display, AI categories, keyboard navigation
FeedList.jsx      - Sidebar feed manager with unread counts
Toolbar.jsx       - Filters (unread/saved/feed), refresh, AI sort
SettingsModal.jsx - LLM provider configuration UI
```

## Important Implementation Details

### Article Content Handling
- Article titles must be sanitized before sending to AI (remove control chars, backslashes, non-ASCII)
- Image URLs are proxied through `/api/image-proxy?url=` to avoid CORS issues
- Relative URLs in images should be skipped (returns 404)

### Feed Sync Behavior
- Syncing all feeds uses Server-Sent Events (SSE) for progress streaming
- Each feed has 15-second timeout
- Duplicate articles detected within same feed using URL normalization
- YouTube video IDs are preserved for thumbnail generation

### Client-Side Filtering
Articles are filtered client-side rather than server-side for performance:
- Filter by `is_read`, `is_saved`, or by `feed_id`
- The server returns all articles, client applies filters

### Settings Storage Pattern
All settings (including LLM config) are stored in `database.json` with prefixes:
- `llm_provider`, `llm_apiKey`, `llm_model`, `llm baseUrl`
- Settings CRUD is in `server/src/routes/settings.js`

## Environment Configuration

Create `server/.env` (see `server/.env.example`):

```bash
PORT=3000
BASIC_AUTH_USER=          # Optional - leave empty to disable
BASIC_AUTH_PASSWORD=      # Optional - leave empty to disable
INCLUDE_SHORTS=false      # Include YouTube Shorts in feeds
```

## Common Tasks

### Adding a New LLM Provider
1. Add case in `server/src/services/ai.js` `callLLM()` function
2. Handle provider-specific URL and request format
3. Extract response content appropriately
4. Add provider option to `client/src/components/SettingsModal.jsx`

### Modifying Article Retention
Edit cleanup rules in `server/src/services/database.js`:
```javascript
const READ_RETENTION_DAYS = 30;
const UNREAD_RETENTION_DAYS = 60;
```

### Adding API Endpoints
1. Create route file in `server/src/routes/`
2. Import and mount in `server/src/index.js`
3. Client accesses via `/api/your-endpoint` (proxied by Vite)

### Debugging Feed Sync Issues
- Check server console for feed-specific errors
- Look for 15-second timeouts on slow feeds
- Verify URL normalization in `normalizeUrl()` function
- YouTube thumbnails use pattern: `img.youtube.com/vi/{videoId}/hqdefault.jpg`
