import { http, HttpResponse } from 'msw';

// Mock data
const mockFeeds = [
  { id: 1, title: 'Tech Blog', url: 'https://example.com/feed' },
  { id: 2, title: 'News Site', url: 'https://news.com/rss' },
];

const mockArticles = [
  {
    id: 1,
    title: 'First Article',
    content: 'This is the first article content with some text.',
    link: 'https://example.com/article1',
    pub_date: new Date().toISOString(),
    feed_id: 1,
    feed_title: 'Tech Blog',
    is_read: false,
    is_saved: false,
    image_url: null,
  },
  {
    id: 2,
    title: 'Second Article',
    content: 'This is the second article content.',
    link: 'https://example.com/article2',
    pub_date: new Date(Date.now() - 3600000).toISOString(),
    feed_id: 1,
    feed_title: 'Tech Blog',
    is_read: true,
    is_saved: false,
    image_url: null,
  },
  {
    id: 3,
    title: 'News Article',
    content: 'Breaking news content here.',
    link: 'https://news.com/article1',
    pub_date: new Date(Date.now() - 7200000).toISOString(),
    feed_id: 2,
    feed_title: 'News Site',
    is_read: false,
    is_saved: true,
    image_url: null,
  },
];

let feedsData = [...mockFeeds];
let articlesData = [...mockArticles];

// Handlers
export const handlers = [
  // GET /api/feeds - Get all feeds
  http.get('/api/feeds', () => {
    return HttpResponse.json(feedsData);
  }),

  // POST /api/feeds - Add feed
  http.post('/api/feeds', async ({ request }) => {
    const body = await request.json();
    const newFeed = {
      id: feedsData.length + 1,
      title: body.title || 'New Feed',
      url: body.url,
    };
    feedsData.push(newFeed);
    return HttpResponse.json(newFeed);
  }),

  // DELETE /api/feeds/:id - Delete feed
  http.delete('/api/feeds/:id', ({ params }) => {
    const id = parseInt(params.id);
    feedsData = feedsData.filter(f => f.id !== id);
    articlesData = articlesData.filter(a => a.feed_id !== id);
    return HttpResponse.json({ success: true });
  }),

  // PATCH /api/feeds/:id - Rename feed
  http.patch('/api/feeds/:id', async ({ request, params }) => {
    const id = parseInt(params.id);
    const body = await request.json();
    const feed = feedsData.find(f => f.id === id);
    if (feed) {
      feed.title = body.title;
    }
    return HttpResponse.json({ success: true });
  }),

  // POST /api/feeds/:id/sync - Sync single feed
  http.post('/api/feeds/:id/sync', ({ params }) => {
    const id = parseInt(params.id);
    const feed = feedsData.find(f => f.id === id);
    if (!feed) {
      return HttpResponse.json({ error: 'Feed not found' }, { status: 404 });
    }
    return HttpResponse.json({
      added: 1,
      updated: 0,
    });
  }),

  // GET /api/feeds/export - Export OPML
  http.get('/api/feeds/export', () => {
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>RSS Feeds Export</title>
  </head>
  <body>
${feedsData.map(feed => `    <outline type="rss" text="${feed.title}" xmlUrl="${feed.url}"/>`).join('\n')}
  </body>
</opml>`;

    return new HttpResponse(opml, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': 'attachment; filename="feeds.opml"',
      },
    });
  }),

  // POST /api/feeds/import - Import OPML
  http.post('/api/feeds/import', async ({ request }) => {
    const body = await request.json();
    // Simple mock import
    return HttpResponse.json({
      imported: 2,
      failed: 0,
      blocked: 0,
      total: 2,
    });
  }),

  // POST /api/feeds/sync-all - Sync all feeds (SSE streaming)
  http.post('/api/feeds/sync-all', () => {
    // Return a mock SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const progress = { type: 'progress', synced: 1, failed: 0, completed: 1, total: 2 };
        controller.enqueue(encoder.encode(JSON.stringify(progress) + '\n'));

        const progress2 = { type: 'progress', synced: 2, failed: 0, completed: 2, total: 2 };
        controller.enqueue(encoder.encode(JSON.stringify(progress2) + '\n'));

        const complete = { type: 'complete', synced: 2, failed: 0, total: 2 };
        controller.enqueue(encoder.encode(JSON.stringify(complete) + '\n'));

        controller.close();
      },
    });

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }),

  // GET /api/articles - Get articles
  http.get('/api/articles', ({ request }) => {
    const url = new URL(request.url);
    const feedId = url.searchParams.get('feedId');
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';

    let filtered = [...articlesData];

    if (feedId) {
      filtered = filtered.filter(a => a.feed_id === parseInt(feedId));
    }

    if (unreadOnly) {
      filtered = filtered.filter(a => !a.is_read);
    }

    return HttpResponse.json(filtered);
  }),

  // PATCH /api/articles/:id/read - Mark as read/unread
  http.patch('/api/articles/:id/read', async ({ request, params }) => {
    const id = parseInt(params.id);
    const body = await request.json();
    const article = articlesData.find(a => a.id === id);
    if (article) {
      article.is_read = body.isRead;
    }
    return HttpResponse.json({ success: true });
  }),

  // PATCH /api/articles/:id/saved - Toggle saved status
  http.patch('/api/articles/:id/saved', async ({ request, params }) => {
    const id = parseInt(params.id);
    const body = await request.json();
    const article = articlesData.find(a => a.id === id);
    if (article) {
      article.is_saved = body.isSaved;
    }
    return HttpResponse.json({ success: true });
  }),

  // POST /api/ai/sort - AI sort articles
  http.post('/api/ai/sort', async ({ request }) => {
    const body = await request.json();

    // Return sorted articles with categories
    const sortedArticles = articlesData.slice(0, Math.min(body.articleIds.length, 10));

    return HttpResponse.json({
      articles: sortedArticles,
      categories: [
        {
          name: 'Technology',
          description: 'Latest tech news and updates',
          articleIds: [1, 2],
        },
        {
          name: 'Science',
          description: 'Scientific discoveries',
          articleIds: [3],
        },
      ],
    });
  }),

  // POST /api/ai/digest - Generate digest
  http.post('/api/ai/digest', async () => {
    return HttpResponse.json({
      digest: 'This is a summary of the articles. Article [ID:1] discusses technology. Article [ID:2] covers innovation.',
    });
  }),

  // GET /api/settings/llm - Get LLM settings
  http.get('/api/settings/llm', () => {
    return HttpResponse.json({
      provider: 'openai',
      apiKey: 'sk-1234...abcd',
      baseUrl: '',
      model: 'gpt-4',
    });
  }),

  // POST /api/settings/llm - Update LLM settings
  http.post('/api/settings/llm', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ success: true });
  }),

  // GET /api/image-proxy - Proxy image requests
  http.get('/api/image-proxy', () => {
    // Return a mock image response
    return new HttpResponse(null, {
      status: 404,
      statusText: 'Not Found',
    });
  }),
];
