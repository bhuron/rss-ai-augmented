# AGENTS.md

This file provides guidance for AI coding agents working in this repository.

## Development Commands

### Client (React + Vite)
```bash
cd client

# Development
npm run dev                  # Start Vite dev server on port 5173

# Testing
npm test                     # Run all tests with Vitest
npm run test:watch           # Watch mode for tests
npm run test:coverage        # Generate coverage report

# Single Test
npx vitest path/to/test.test.jsx       # Run specific test file
npx vitest --testNamePattern="Keyword"  # Run tests matching pattern

# Build
npm run build                # Production build to dist/
npm run build:analyze        # Build with bundle analysis
```

### Server (Node.js + Express)
```bash
cd server

# Development
npm run dev                  # Start with --watch (auto-restart)
npm start                    # Production mode

# Testing
npm test                     # Run all tests with Vitest
npm run test:watch           # Watch mode
npm run test:coverage        # Coverage report

# Single Test
npx vitest path/to/test.test.js         # Run specific test file
npx vitest --testNamePattern="Keyword"  # Run tests by pattern
```

### Root (PM2 Process Management)
```bash
npm start                    # Start both client and server with PM2
npm stop                     # Stop processes
npm restart                  # Restart processes
npm reload                   # Zero-downtime reload
npm logs                     # View logs
npm status                   # Check status
```

## Code Style Guidelines

### Project Structure
- **ES Modules**: Both client and server use `"type": "module"` in package.json
- **Monorepo**: Root PM2 config manages both services
- **Client/Server separation**: Client proxies `/api` to backend via Vite (see vite.config.js)

### File Naming Conventions
- React components: `PascalCase.jsx` (e.g., `ArticleList.jsx`)
- Hooks: `use*.js` (e.g., `useArticles.js`)
- Server routes: `*.js` (e.g., `feeds.js`)
- Services: `*.js` (e.g., `database.js`, `ai.js`)
- Tests: `*.test.jsx` (client), `*.test.js` (server)

### Imports
- Use named imports: `import { useState } from 'react'`
- Local imports use `.js` extension: `import { api } from './utils/api.js'`
- Group imports: external libs first, then internal
- Sort imports alphabetically within groups

### React Patterns
- **Functional components only** - no class components
- **Custom hooks** for logic extraction (see `client/src/hooks/`)
- **Memoization**: Use `useMemo` and `useCallback` for expensive computations
- **Props destructuring**: `function Component({ prop1, prop2 }) { ... }`
- **Lazy loading**: Use `React.lazy()` for modals and infrequent components
- **Error boundaries**: Wrap components where needed (see `ErrorBoundary.jsx`)

### Server Patterns
- **Route organization**: One file per resource in `server/src/routes/`
- **Validation middleware**: Use `validateBody`, `validateParams`, `validateQuery` with Zod schemas
- **Async handlers**: Wrap route handlers with `asyncHandler()` to catch errors
- **Services**: Business logic in `server/src/services/` (database, ai, rss, url-validator)
- **Schemas**: Zod validation schemas in `server/src/schemas/`
- **Error handling**: Custom `APIError` class, global error middleware

### Validation & Schema
- **Zod schemas**: All API requests/responses validated with Zod
- **Schema location**: `server/src/schemas/api.js` for API, `database.js` for data models
- **Validation middleware**: `server/src/middleware/validate.js` provides helpers
- **Client-side validation**: Client validates requests via `api.js` using same schemas

### Error Handling
- **Client**: Custom `APIError` class with status and details
- **Server**: Use `asyncHandler()` middleware to catch errors
- **Logging**: `console.error()` for errors, avoid leaking details to clients
- **Fallback behavior**: AI sorting/digesting returns fallback on failure (see `server/src/services/ai.js`)

### Security Requirements
- **SSRF Protection**: All URLs validated via `validateUrl()` before fetching (blocks private IPs, metadata endpoints)
- **Rate limiting**: Sync endpoints rate-limited to 1 request/minute per IP
- **Content-Type validation**: Image proxy validates images before serving
- **XXE prevention**: XML parser configured securely (fast-xml-parser with security options)
- **API key masking**: LLM API keys masked in settings responses
- **CORS**: Configured via environment variable, credentials enabled

### Testing Guidelines
- **Unit tests**: Isolated component/hook tests in `test/unit/`
- **Integration tests**: API and feature tests in `test/integration/`
- **Security tests**: SSRF and URL normalization tests in `test/security/`
- **Mocking**: Use Vitest's `vi.mock()` for services/dependencies
- **Test setup**: Create Express app for API tests, use @testing-library/react for components
- **Clear mocks**: `beforeEach(() => vi.clearAllMocks())` to prevent test pollution

### Database & Data Handling
- **JSON file database**: `server/database.json` with automatic persistence
- **CRUD operations**: Use `articleOps` and `feedOps` from database service
- **URL normalization**: Duplicate detection via `normalizeUrl()` (removes tracking params)
- **Retention policy**: 30 days for read, 60 days for unread, saved forever
- **Client-side filtering**: Articles filtered by client for performance (unread/saved/feed filters)

### AI Integration
- **Provider-agnostic**: Supports OpenAI, Anthropic, OpenRouter, Ollama, custom
- **Sanitization**: Article titles sanitized before AI (remove control chars, backslashes, non-ASCII)
- **Batching**: Max 100 articles, max 10 per feed to prevent dominance
- **Fallback behavior**: Returns original order with generic category if AI fails
- **Settings stored**: All LLM config in database with `llm_` prefix

### Code Quality
- **No comments**: Code should be self-documenting (avoid unnecessary comments)
- **Async/await**: Use async/await over promise chains
- **Early returns**: Prefer early returns for error conditions
- **Function length**: Keep functions under 50 lines when possible
- **DRY principle**: Extract repeated logic into services/hooks

### Common Patterns

**Custom Hook Pattern** (client):
```javascript
export function useFeature({ param1, param2 }) {
  const [state, setState] = useState(null);
  const fetch = useCallback(async () => {
    // Logic
  }, [param1, param2]);
  return { state, fetch };
}
```

**Route Handler Pattern** (server):
```javascript
router.post('/endpoint',
  validateBody(RequestSchema),
  validateParams(ParamSchema),
  asyncHandler(async (req, res) => {
    // Handler logic - errors caught by asyncHandler
  })
);
```

**Service Pattern** (server):
```javascript
export async function doSomething(config, data) {
  if (!config) throw new Error('Missing config');
  try {
    // Business logic
    return result;
  } catch (error) {
    console.error('Error:', error);
    throw error; // Re-throw to be handled by route
  }
}
```

### Important Gotchas
- **Vite proxy**: Client uses Vite proxy for `/api` requests, production needs web server proxy config
- **Article filtering**: Server returns all articles, client applies filters for performance
- **Parallel fetching**: Client fetches filtered AND all articles simultaneously (for accurate unread counts)
- **Image proxy**: Use `/api/image-proxy?url=` for article images to bypass CORS
- **YouTube feeds**: Auto-convert channel URLs to RSS, extract thumbnails from video IDs
- **Feed sync timeout**: Each feed has 15s timeout during sync-all
- **Zod validation**: Schema errors return only first message to user (see validate.js)
- **No linting**: Project has no ESLint/Prettier config - follow conventions from existing code
