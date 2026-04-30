export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { action, payload } = await req.json();

    if (action === 'news') return await fetchNews(payload);
    if (action === 'ai') return await callAI(payload);
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
}

async function fetchNews({ teams }) {
  const NEWS_KEY = process.env.NEWS_API_KEY;
  const queries = teams.map(t => encodeURIComponent(t)).join(' OR ');
  const url = `https://newsapi.org/v2/everything?q=${queries}&language=en&sortBy=publishedAt&pageSize=30&apiKey=${NEWS_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.articles) return json({ articles: [] });

  const articles = data.articles
    .filter(a => a.title && a.description && a.title !== '[Removed]')
    .slice(0, 20)
    .map(a => ({
      title: a.title,
      description: a.description,
      url: a.url,
      source: a.source?.name || 'Unknown',
      publishedAt: a.publishedAt,
    }));

  return json({ articles });
}

async function callAI({ prompt, systemPrompt }) {
  const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt || 'You are a concise sports intelligence assistant.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();
  if (data.error) return json({ error: data.error.message }, 500);
  const text = data.content?.find(c => c.type === 'text')?.text || '';
  return json({ text });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
