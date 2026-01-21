async function callLLM(config, messages, temperature = 0.7) {
  const { provider, apiKey, baseUrl, model } = config;

  if (!provider || !model) {
    throw new Error('LLM provider and model must be configured');
  }

  if (provider !== 'ollama' && !apiKey) {
    throw new Error('LLM API key not configured');
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  let url, body;

  switch (provider) {
    case 'openai':
      url = baseUrl || 'https://api.openai.com/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = { model, messages, temperature };
      break;

    case 'anthropic':
      url = baseUrl || 'https://api.anthropic.com/v1/messages';
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      body = {
        model,
        messages,
        temperature,
        max_tokens: 4096
      };
      break;

    case 'openrouter':
      url = 'https://openrouter.ai/api/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = { model, messages, temperature };
      break;

    case 'ollama':
      url = `${baseUrl || 'http://localhost:11434'}/api/chat`;
      body = { model, messages, stream: false };
      break;

    case 'custom':
      url = baseUrl;
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = { model, messages, temperature };
      break;

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error: ${error}`);
  }

  const data = await response.json();

  // Extract content based on provider response format
  if (provider === 'anthropic') {
    return data.content[0].text;
  } else if (provider === 'ollama') {
    return data.message.content;
  } else {
    return data.choices[0].message.content;
  }
}

function parseJSON(content) {
  // Remove markdown code blocks if present
  let cleaned = content.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
  }
  return JSON.parse(cleaned.trim());
}

export async function sortArticles(config, articles, criteria = 'relevance and importance') {
  // Sanitize article titles to prevent JSON encoding issues
  const sanitizeText = (text) => {
    if (!text) return '';
    return text
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
      .replace(/\\/g, '') // Remove all backslashes to avoid escape issues
      .replace(/"/g, "'") // Replace quotes with single quotes
      .replace(/\r?\n/g, ' ') // Replace newlines with spaces
      .replace(/[\u0080-\uFFFF]/g, '') // Remove all non-ASCII characters
      .trim();
  };

  // Limit article list to keep prompt manageable - truncate titles more aggressively
  const articleList = articles.map(a => {
    const title = sanitizeText(a.title);
    const truncated = title.length > 80 ? title.substring(0, 80) + '...' : title;
    return `ID:${a.id} - ${truncated}`;
  }).join('\n');

  const prompt = `Analyze and categorize these ${articles.length} articles by ${criteria}.

Articles:
${articleList}

Return a JSON object with a digest and categories:
{
  "digest": "2-3 paragraph executive summary covering: key themes/trends, notable highlights, brief summary of each category. When mentioning specific articles, reference them as [ID:123] inline.",
  "categories": [
    {"name": "Category Name", "description": "Brief reason", "articleIds": [1, 2]}
  ],
  "sortedIds": [3, 1, 5, 2, 4]
}

IMPORTANT: 
- Use the numeric IDs from "ID:xxx"
- Include ALL ${articles.length} article IDs in sortedIds
- Create 3-5 meaningful categories
- Keep category descriptions under 80 characters
- Write digest in conversational, executive summary style
- Reference major articles in digest using [ID:123] format`;

  try {
    const content = await callLLM(config, [{ role: 'user', content: prompt }], 0.2);
    const result = parseJSON(content);
    
    // Validate response
    if (!result.sortedIds || !Array.isArray(result.sortedIds)) {
      console.error('Invalid LLM response - missing sortedIds');
      // Fallback: return original order with generic categories
      return {
        articles: articles,
        categories: result.categories || [
          { name: 'All Articles', description: 'Sorted by date', articleIds: articles.map(a => a.id) }
        ]
      };
    }
    
    // Create a map for quick lookup
    const articleMap = new Map(articles.map(a => [a.id, a]));
    
    // Map sorted IDs to actual articles
    const sortedArticles = result.sortedIds
      .map(id => articleMap.get(id))
      .filter(a => a !== undefined && a !== null && typeof a === 'object');
    
    // If we lost articles, add them back at the end
    if (sortedArticles.length < articles.length) {
      const sortedIds = new Set(result.sortedIds);
      const missing = articles.filter(a => !sortedIds.has(a.id));
      sortedArticles.push(...missing);
      console.log(`Added ${missing.length} missing articles to the end`);
    }
    
    console.log(`Sorted ${sortedArticles.length} articles into ${result.categories?.length || 0} categories`);
    
    // Add digest as first "category" if present
    const categories = result.categories || [];
    if (result.digest) {
      categories.unshift({
        name: "Daily Digest",
        description: result.digest,
        articleIds: [],
        isDigest: true
      });
    }
    
    return {
      articles: sortedArticles,
      categories: categories
    };
  } catch (error) {
    console.error('Error in sortArticles:', error);
    // Fallback: return original articles
    return {
      articles: articles,
      categories: [
        { name: 'All Articles', description: 'Original order (sorting failed)', articleIds: articles.map(a => a.id) }
      ]
    };
  }
}

export async function generateDigest(config, articles) {
  // Reduce content length to speed up processing
  const articleList = articles.map(a => 
    `- ${a.title}\n  ${a.content?.substring(0, 150)}...`
  ).join('\n\n');

  const prompt = `Create a concise digest of these articles. Group by topic and highlight key insights:

${articleList}

Format your response in clean markdown with headers and bullet points. Keep it brief.`;

  return await callLLM(config, [{ role: 'user', content: prompt }], 0.7);
}
