export const prerender = false;

import { DAILY_PROMPT } from '../../../lib/daily-prompt';

const OWNER = import.meta.env.GH_OWNER || '466767686';
const REPO = import.meta.env.GH_REPO || 'yuri-blog';
const BRANCH = 'main';
const CRON_SECRET = import.meta.env.CRON_SECRET || '';
const ADMIN_PASSWORD = import.meta.env.ADMIN_PASSWORD || '';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

function authorize(request: Request) {
  const auth = request.headers.get('authorization') || '';
  return (!!CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) || (!!ADMIN_PASSWORD && auth === `Bearer ${ADMIN_PASSWORD}`);
}

function beijingNow() {
  const now = new Date();
  const s = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  const [d, t] = s.split(' ');
  const [y, m, day] = d.split('/').map(Number);
  const [hh, mm, ss] = t.split(':').map(Number);
  return { y, m, day, hh, mm, ss, weekday: now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', weekday: 'short' }) };
}

async function github(path: string, opts: any = {}) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
  const headers: any = {
    Authorization: `Bearer ${import.meta.env.GH_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (opts.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(data?.message || `GitHub API ${res.status}`);
  return data;
}

async function generateEssay() {
  const now = beijingNow();
  const dateInfo = `今天的日期是 ${now.y}年${now.m}月${now.day}日，星期${now.weekday}。`;
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: dateInfo + '\n\n' + DAILY_PROMPT }],
      temperature: 1.15,
      max_tokens: 900,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `DeepSeek API ${res.status}`);
  const output: string = data.choices?.[0]?.message?.content || '';
  const lines = output.trim().split('\n');
  const title = lines[0]
    .replace(/^#+\s*/, '')
    .replace(/^标题[:：]\s*/, '')
    .replace(/\*\*/g, '')
    .trim();
  const body = lines.slice(1).join('\n').trim();
  if (!title || !body) throw new Error('AI 输出格式异常');
  return { title, body, now };
}

export async function GET({ request }: { request: Request }) {
  if (!authorize(request)) return json({ ok: false, error: '未授权' }, 401);
  try {
    const { title, body, now } = await generateEssay();
    const dateStr = `${now.y}-${String(now.m).padStart(2, '0')}-${String(now.day).padStart(2, '0')}`;
    const link = `daily-${dateStr}`;
    const path = `src/content/blog/life/${link}.md`;
    const fm = [
      '---',
      `title: ${JSON.stringify(title)}`,
      `link: ${link}`,
      `date: ${dateStr} 23:00:00`,
      'catalog: true',
      'tags:',
      '  - 随笔',
      'categories:',
      '  - 随笔',
      '---',
    ].join('\n');
    const content = fm + '\n' + body + '\n';
    try {
      await github(path);
      return json({ ok: false, error: '今天已生成过，跳过' }, 409);
    } catch {}
    const data = await github(path, {
      method: 'PUT',
      body: JSON.stringify({
        message: `daily: ${title}`,
        content: Buffer.from(content, 'utf8').toString('base64'),
        branch: BRANCH,
      }),
    });
    return json({ ok: true, title, link, url: data.content?.html_url });
  } catch (e: any) {
    return json({ ok: false, error: e.message || '服务器错误' }, 500);
  }
}
