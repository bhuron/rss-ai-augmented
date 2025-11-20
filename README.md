# RSS + LLM Reader

An intelligent RSS reader that uses AI to sort and digest articles.

## Features
- Feed management (add/remove RSS feeds)
- Article list with unread tracking
- AI-powered article sorting by relevance
- AI-generated digests
- **Provider-agnostic LLM support** (OpenAI, Anthropic, OpenRouter, Ollama, or custom)

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
