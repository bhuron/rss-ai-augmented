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
  // Limit article list to keep prompt manageable
  const articleList = articles.map(a => {
    const title = a.title.length > 100 ? a.title.substring(0, 100) + '...' : a.title;
    return `ID:${a.id} - ${title}`;
  }).join('\n');

  const prompt = `Analyze and categorize these ${articles.length} articles by ${criteria}.

Articles:
${articleList}

Return a JSON object with categories and sorted article IDs:
{
  "categories": [
    {"name": "Category Name", "description": "Brief reason", "articleIds": [1, 2]}
  ],
  "sortedIds": [3, 1, 5, 2, 4]
}

IMPORTANT: 
- Use the numeric IDs from "ID:xxx"
- Include ALL ${articles.length} article IDs in sortedIds
- Create 3-6 meaningful categories
- Keep descriptions under 100 characters`;

  try {
    const content = await callLLM(config, [{ role: 'user', content: prompt }], 0.3);
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
      .filter(a => a !== undefined);
    
    // If we lost articles, add them back at the end
    if (sortedArticles.length < articles.length) {
      const sortedIds = new Set(result.sortedIds);
      const missing = articles.filter(a => !sortedIds.has(a.id));
      sortedArticles.push(...missing);
      console.log(`Added ${missing.length} missing articles to the end`);
    }
    
    console.log(`Sorted ${sortedArticles.length} articles into ${result.categories?.length || 0} categories`);
    
    return {
      articles: sortedArticles,
      categories: result.categories || []
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
  const articleList = articles.map(a => 
    `- ${a.title}\n  ${a.content?.substring(0, 300)}...`
  ).join('\n\n');

  const prompt = `Create a concise digest of these articles. Group by topic and highlight key insights:

${articleList}

Format your response in clean markdown with headers and bullet points.`;

  return await callLLM(config, [{ role: 'user', content: prompt }], 0.7);
}
