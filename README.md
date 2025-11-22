# RSS + LLM Reader

An intelligent RSS reader that uses AI to sort and digest articles.

## Features
- Feed management (add/remove RSS feeds)
- Article list with unread tracking
- AI-powered article sorting by relevance
- AI-generated digests
- **Provider-agnostic LLM support** (OpenAI, Anthropic, OpenRouter, Ollama, or custom)
- Collapsible sidebar with hover interaction
- Keyboard shortcuts for navigation
- Unread article tracking
- OPML import/export

## Setup

### Backend
```bash
cd server
npm install
npm run dev
```

### Frontend
```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173 and click the ⚙️ Settings button to configure your LLM provider.

## Supported LLM Providers
- **OpenAI** (GPT-4, GPT-3.5, etc.)
- **Anthropic** (Claude 3.5 Sonnet, etc.)
- **OpenRouter** (access to multiple models)
- **Ollama** (local models, no API key needed)
- **Custom** (any OpenAI-compatible API)

All configuration is done through the web UI - no environment variables needed!

## Keyboard Shortcuts
- `j` / `↓` / `n` - Next article (marks current as read)
- `k` / `↑` - Previous article
- `Enter` / `o` - Open article in new tab (marks as read)
- `v` - Open article without marking as read
- `m` - Toggle read/unread status
- `c` - Clear categories and return to chronological view
- `r` - Refresh all feeds

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

Copyright (C) 2025 RSS + LLM Reader Contributors

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
