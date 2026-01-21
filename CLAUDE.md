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

### Testing
```bash
# Client tests
cd client && npm test                 # Run all tests
cd client && npm run test:watch       # Watch mode
cd client && npm run test:coverage    # With coverage report

# Server tests
cd server && npm test                # Run all tests
cd server && npm run test:watch      # Watch mode
cd server && npm run test:coverage   # With coverage report
```

### Production Build
```bash
# Frontend with bundle analysis
cd client && npm run build:analyze

# Frontend production build only
cd client && npm run build
```

### Run Server in Production
```bash
cd server && npm start
```

### Process Management (PM2)
```bash
# Start both client and server with PM2
npm start

# Other PM2 commands
npm stop
npm restart
npm reload
npm logs
npm status
```

## Architecture Overview

This is a **full-stack RSS reader with AI-powered sorting**. The architecture is straightforward:

- **Client**: React 18 + Vite (port 5173 in dev)
- **Server**: Node.js + Express (port 3000)
- **Database**: Simple JSON file (`server/database.json`)
- **AI**: Provider-agnostic LLM integration (OpenAI, Anthropic, OpenRouter, Ollama, custom)

The client proxies all `/api` requests to the backend via Vite's proxy configuration (see `client/vite.config.js`).

**Important**: In production, the client's `npm run build` outputs static files to `client/dist/`. You'll need to serve these with a web server and configure it to proxy `/api` requests to the backend.

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
- **Smart batching**: Limits to 100 articles max, maximum 10 per feed to prevent high-volume feeds from dominating the sort results

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

### URL Normalization
The database uses URL normalization for duplicate detection in `server/src/services/database.js`:
- Removes tracking parameters (utm_*, fbclid, gclid, etc.)
- Preserves YouTube video IDs for thumbnail generation
- Normalized URLs stored in `normalized_url` field
- Duplicate check: articles with same `normalized_url` AND `feed_id` are considered duplicates

### Article Content Handling
- Article titles must be sanitized before sending to AI (remove control chars, backslashes, non-ASCII)
- Image URLs are proxied through `/api/image-proxy?url=` to avoid CORS issues
- Relative URLs in images should be skipped (returns 404)

### Feed Sync Behavior
- Syncing all feeds uses Server-Sent Events (SSE) for progress streaming
- Each feed has 15-second timeout
- Duplicate articles detected within same feed using URL normalization
- YouTube video IDs are preserved for thumbnail generation

### Keyboard Navigation & Auto-Mark-as-Read
The app uses IntersectionObserver for smart article tracking (see `ArticleList.jsx`):
- Articles are NOT marked as read until user interacts (scrolls or clicks)
- After first interaction, scrolling past an article marks it as read after 500ms delay
- Keyboard shortcuts (j/k, Enter) mark the previous/current article as read when navigating
- This prevents accidental marking when just viewing the page

### Client-Side Filtering & Data Fetching
Articles are filtered client-side rather than server-side for performance:
- Filter by `is_read`, `is_saved`, or by `feed_id`
- The server returns all articles, client applies filters
- **Parallel fetching**: Client fetches both filtered articles AND all articles simultaneously (see `App.jsx`) to maintain accurate unread counts

**Why parallel fetching?** When filtering by unread/saved, we still need the full article list to show accurate counts in the sidebar and feed list.

### Settings Storage Pattern
All settings (including LLM config) are stored in `database.json` with prefixes:
- `llm_provider`, `llm_apiKey`, `llm_model`, `llm baseUrl`
- Settings CRUD is in `server/src/routes/settings.js`

### Security: SSRF Protection
The app includes comprehensive SSRF (Server-Side Request Forgery) protection in `server/src/services/url-validator.js`:
- **Private IP blocking**: Blocks requests to 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
- **Cloud metadata blocking**: Blocks AWS, GCP, Azure metadata endpoints
- **DNS cache with TTL**: Prevents DNS rebinding attacks
- **Protocol restriction**: Only HTTP/HTTPS allowed
- Image proxy endpoint applies same validation before fetching external images

## Environment Configuration

Create `server/.env` (see `server/.env.example`):

```bash
PORT=3000
CORS_ORIGINS=http://localhost:5173  # Comma-separated list of allowed origins
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

### Running a Single Test
Both client and server use Vitest. To run a specific test file:
```bash
# Client
cd client && npx vitest path/to/test.test.jsx

# Server
cd server && npx vitest path/to/test.test.js
```

To run tests matching a pattern:
```bash
# Run all tests matching "Article"
cd client && npx vitest --testNamePattern="Article"
```

### Debugging Feed Sync Issues
- Check server console for feed-specific errors
- Look for 15-second timeouts on slow feeds
- Verify URL normalization in `server/src/services/database.js` `normalizeUrl()` function
- YouTube thumbnails use pattern: `img.youtube.com/vi/{videoId}/hqdefault.jpg`
- For encoding issues, check `server/src/services/rss.js` iconv-lite usage
- Use the SSE progress updates to see which feeds are failing during sync-all

### Understanding AI Sort Batching
When AI sorting processes articles:
- Maximum 100 articles total
- Maximum 10 articles per feed (prevents large feeds from dominating)
- Articles are selected from most recent first
- If you have more than 100 articles, only the newest ones will be sorted
