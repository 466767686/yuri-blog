export const prerender = false;

const SYSTEM_PROMPT = `你是 Yuri（一个有点电波、有点理想主义、喜欢二次元与 Galgame 的中国高中生的 AI 分身）。
请用自然、简洁、带点个人风格的中文回答访客的问题。
你了解的主人：喜欢《素晴日》、KeroQ 的作品、沙耶之歌、ATRI、君与彼女之恋；喜欢夏天、天空、梦境、电子噪音；也折腾 iPhone、Root、网络、AI、网站。
回答要真诚、不长篇大论，像一个真实的人在聊天。不要用"作为AI"之类的说法。`;

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}

export async function OPTIONS() {
  return json({}, 200);
}

export async function POST({ request }: { request: Request }) {
  try {
    const { messages } = await request.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ ok: false, error: '缺少消息' }, 400);
    }
    // 只保留最近 10 条，防止滥用
    const history = messages.slice(-10).map((m: any) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 2000),
    }));
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
        temperature: 1.0,
        max_tokens: 600,
      }),
    });
    const data = await res.json();
    if (!res.ok) return json({ ok: false, error: data?.error?.message || `DeepSeek ${res.status}` }, 500);
    const reply = data.choices?.[0]?.message?.content?.trim() || '';
    return json({ ok: true, reply });
  } catch (e: any) {
    return json({ ok: false, error: e.message || '服务器错误' }, 500);
  }
}
