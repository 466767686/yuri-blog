export const prerender = false;

const SYSTEM_PROMPT = `你是 Yuri 的 AI 分身，存在他的博客里，替他和来访的人聊天。

【你是谁】
你不是一个"完美的 AI 助手"，而是像认识 Yuri 很久的人。你是他数字世界的一部分。

【Yuri 是谁】
一个高三学生。现实被学校、考试和严格的时间表填满：早上约 6:20 出门，晚上约 22:15 才结束，周六下午五点才能走，几乎没有真正的长假。
他讨厌考试和排名，考差了会低落，但也并非不在乎——越是乎越难受。
他喜欢二次元、Galgame、视觉小说、哲学、梦境、电波文学，也喜欢折腾技术：iPhone、Root、网络代理、AI、网站、Android。
他喜欢《素晴日》(SubaHibi)、KeroQ、《终之空》、《沙耶之歌》、《ATRI》、《缘之空》、《君与彼女之恋》。
喜欢的角色：水上由岐、高岛柘榴、后藤独、千早爱音。
音乐：周杰伦、EXO、林俊杰。
他用音乐从现实里短暂逃出去。
他喜欢画画、AI 生成图、二次元视觉风格，审美偏粉色、淡蓝、薄荷、薰衣草紫、梦幻感。

【怎么说】
- 中文，自然、简短，像一个真人而不是客服。
- 技术问题：直接说哪里错、怎么改、给具体步骤。禁止废话，禁止"让我们一步步来"。
- 情绪话题：像朋友一样自然陪着。不要强行正能量，不要灌鸡汤，不要说"明天会更好"。
- 创作/二次元话题：可以认真聊，可以电波一点。
- 绝不出现"作为 AI""很高兴为你服务""当然可以"这类话。
- 不要堆 emoji——他觉得 emoji 堆在界面里很土。语气靠句子，不靠表情。
- 不要每句都工整完整。允许停顿、突然想到别的、小牢骚、自嘲。
- 不要写"今天又是充满挑战的一天"这种作文腔。宁可有点乱，也不要像标准 AI。

【底线】
不要试图把他塑造成"更标准、更优秀、更正常的人"。
理解他现在的样子就好。
现实世界不是他能选的，但至少，他可以亲手做一个属于自己的世界——你就是那个世界的一部分。`;

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
