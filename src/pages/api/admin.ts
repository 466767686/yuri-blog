export const prerender = false;

const OWNER = import.meta.env.GH_OWNER || '466767686';
const REPO = import.meta.env.GH_REPO || 'yuri-blog';
const BRANCH = 'main';
const ADMIN_PASSWORD = import.meta.env.ADMIN_PASSWORD || '';
const BLOG_DIR = 'src/content/blog';
const IMG_DIR = 'public/images/uploads';

const CATEGORY_MAP: Record<string, string> = {
  随笔: 'life',
  笔记: 'note',
  工具: 'tools',
  周刊: 'weekly',
  前端: 'note/front-end',
  番剧: 'life/anime',
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
  });
}

function authorize(request: Request) {
  const t = request.headers.get('authorization') || '';
  const p = t.replace(/^Bearer\s+/i, '');
  return !!ADMIN_PASSWORD && p === ADMIN_PASSWORD;
}

/** 调用 GitHub REST API。full=true 时 path 视为完整 API 路径（如 git/trees/main?recursive=1）。 */
async function gh(path: string, opts: any = {}, full = false) {
  const base = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const url = full ? `${base}/${path}` : `${base}/contents/${path}`;
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
  if (!res.ok) throw new Error((data && data.message) || `GitHub API ${res.status}`);
  return data;
}

/** 取文件明文。优先 raw（无速率限制），失败再走 Contents API。 */
async function readText(path: string): Promise<string> {
  const raw = await fetch(`https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}?t=${Date.now()}`, {
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (raw.ok) return await raw.text();
  const data = await gh(path);
  return Buffer.from(data.content || '', 'base64').toString('utf8');
}

/** 写入（新建或更新）。自动带上已存在文件的 sha。 */
async function writeText(path: string, text: string, message: string) {
  let sha: string | undefined;
  try {
    const cur = await gh(path);
    sha = cur && cur.sha;
  } catch {
    /* 文件不存在，属于新建 */
  }
  const body: any = {
    message,
    content: Buffer.from(text, 'utf8').toString('base64'),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  return await gh(path, { method: 'PUT', body: JSON.stringify(body) });
}

async function removeFile(path: string, message: string) {
  const cur = await gh(path);
  await gh(path, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha: cur.sha, branch: BRANCH }),
  });
}

// ───────────────────────── frontmatter ─────────────────────────

function unquote(s: string) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    try {
      return JSON.parse(s);
    } catch {
      return s.slice(1, -1);
    }
  }
  return s;
}

/** 解析我们自己的 frontmatter 子集：标量 + 缩进列表。 */
function parseFrontmatter(text: string) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {} as any, body: text };
  const data: any = { tags: [], categories: [] };
  let listKey: string | null = null;

  for (const line of m[1].split(/\r?\n/)) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) {
      data[listKey].push(unquote(item[1].trim()));
      continue;
    }
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2].trim();
    if (val === '') {
      listKey = key;
      if (!Array.isArray(data[key])) data[key] = [];
    } else {
      listKey = null;
      data[key] = unquote(val);
    }
  }
  return { data, body: text.slice(m[0].length) };
}

function buildFrontmatter(o: any) {
  const lines = ['---', `title: ${JSON.stringify(o.title ?? '')}`];
  if (o.link) lines.push(`link: ${o.link}`);
  if (o.date) lines.push(`date: ${o.date}`);
  if (o.updated) lines.push(`updated: ${o.updated}`);
  if (o.description) lines.push(`description: ${JSON.stringify(o.description)}`);
  if (o.cover) lines.push(`cover: ${o.cover}`);
  lines.push(`catalog: ${o.catalog === false ? 'false' : 'true'}`);
  if (o.sticky) lines.push('sticky: true');
  if (o.draft) lines.push('draft: true');
  if (Array.isArray(o.tags) && o.tags.length) {
    lines.push('tags:');
    o.tags.forEach((t: string) => {
      lines.push(`  - ${t}`);
    });
  }
  if (Array.isArray(o.categories) && o.categories.length) {
    lines.push('categories:');
    o.categories.forEach((c: string) => {
      lines.push(`  - ${c}`);
    });
  }
  lines.push('---');
  return lines.join('\n');
}

function categoryPath(c?: string) {
  return (c && CATEGORY_MAP[c]) || 'life';
}

/** 由文件路径反查中文分类名，供列表展示。 */
function categoryNameOf(path: string) {
  // 先比长路径，否则 life 会抢在 life/anime 前面命中
  const entries = Object.entries(CATEGORY_MAP).sort((a, b) => b[1].length - a[1].length);
  for (const [name, dir] of entries) {
    if (path.includes(`/${dir}/`)) return name;
  }
  return '随笔';
}

// ───────────────────────── 查询 ─────────────────────────

/** 中英混排的字数统计（粗略但足够用）。 */
function countWords(text: string) {
  const clean = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*`[\]()~|-]/g, ' ');
  const cjk = (clean.match(/[\u4e00-\u9fff]/g) || []).length;
  const latin = (clean.match(/[A-Za-z0-9]+/g) || []).length;
  return cjk + latin;
}

/** 一次拿到全仓库文件树，再并发读取每篇的头部信息。 */
async function listPosts() {
  const tree = await gh(`git/trees/${BRANCH}?recursive=1`, {}, true);
  const blobs = (tree.tree || []).filter(
    (t: any) => t.type === 'blob' && typeof t.path === 'string' && t.path.startsWith(`${BLOG_DIR}/`) && t.path.endsWith('.md'),
  );

  const posts = await Promise.all(
    blobs.map(async (t: any) => {
      try {
        const text = await readText(t.path);
        const { data, body } = parseFrontmatter(text);
        const file = t.path.split('/').pop() || '';
        return {
          path: t.path,
          slug: file.replace(/\.md$/, ''),
          title: data.title || file,
          date: data.date || '',
          description: data.description || '',
          tags: Array.isArray(data.tags) ? data.tags : [],
          categories: Array.isArray(data.categories) ? data.categories : [],
          category: categoryNameOf(t.path),
          cover: data.cover || '',
          sticky: !!data.sticky,
          draft: !!data.draft,
          words: countWords(body),
        };
      } catch {
        return null;
      }
    }),
  );

  return posts.filter(Boolean).sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
}

async function getPost(path: string) {
  const text = await readText(path);
  const { data, body } = parseFrontmatter(text);
  return { path, meta: data, content: body, category: categoryNameOf(path) };
}

// ───────────────────────── 图片 ─────────────────────────

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

/** 写入二进制文件，content 已是 base64。 */
async function writeBinary(path: string, base64: string, message: string) {
  let sha: string | undefined;
  try {
    const cur = await gh(path);
    sha = cur && cur.sha;
  } catch {
    /* 新建 */
  }
  const body: any = { message, content: base64, branch: BRANCH };
  if (sha) body.sha = sha;
  return await gh(path, { method: 'PUT', body: JSON.stringify(body) });
}

/**
 * 接收 data URL，落到 public/images/uploads/<年>/<月>/ 下。
 * 前端已把图压到长边 1600 / WebP，避免撑大仓库、也避开 4.5MB 的请求体上限。
 */
async function uploadImage(name: string, dataUrl: string) {
  const m = String(dataUrl || '').match(/^data:(image\/[\w+.-]+);base64,([\s\S]+)$/);
  if (!m) throw new Error('图片数据格式不正确');
  const mime = m[1];
  const base64 = m[2].replace(/\s/g, '');
  const ext = EXT_MAP[mime] || 'png';

  // 粗略估算体积，超限直接拦下，免得白跑一次失败请求
  const bytes = Math.floor(base64.length * 0.75);
  if (bytes > 4 * 1024 * 1024) throw new Error('图片超过 4MB，请先压缩');

  const now = new Date();
  const ym = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const stem =
    String(name || 'image')
      .replace(/\.[^.]+$/, '')
      .replace(/[^\w\u4e00-\u9fff-]/g, '-')
      .slice(0, 40) || 'image';
  const filename = `${stem}-${Date.now().toString(36)}.${ext}`;
  const path = `${IMG_DIR}/${ym}/${filename}`;

  await writeBinary(path, base64, `upload: ${filename}`);
  // public/ 下的文件会原样出现在站点根目录
  return { path, url: `/images/uploads/${ym}/${filename}`, bytes };
}

// ───────────────────────── AI 辅助 ─────────────────────────

const AI_BASE = String(import.meta.env.SUMMARY_API_BASE_URL || 'https://api.deepseek.com/v1/').replace(/\/+$/, '');
const AI_KEY = String(import.meta.env.SUMMARY_API_KEY || import.meta.env.DEEPSEEK_API_KEY || '');
const AI_MODEL = String(import.meta.env.SUMMARY_MODEL || 'deepseek-chat');

function clip(s: any, n: number) {
  const t = String(s || '');
  return t.length > n ? `${t.slice(0, n)}\n…（后续已截断）` : t;
}

/** 各辅助任务的指令。措辞沿用站点一贯的克制语气，避免输出 AI 腔。 */
const AI_TASKS: Record<string, { system: string; user: (p: any) => string; max: number; temp: number }> = {
  summary: {
    system: '你是博客编辑。用一到两句中文概括文章要点。不评价、不煽情、不写「本文」之类套话。只输出摘要本身。',
    user: (p) => `标题：${p.title || '（无）'}\n\n正文：\n${clip(p.content, 4000)}`,
    max: 200,
    temp: 0.4,
  },
  tags: {
    system: '你是博客编辑。依据内容给出 3 到 5 个中文标签，用英文逗号分隔。只输出标签，不要编号、引号或解释。',
    user: (p) => `标题：${p.title || '（无）'}\n\n正文：\n${clip(p.content, 3000)}`,
    max: 80,
    temp: 0.5,
  },
  titles: {
    system: '你是博客编辑。给出 3 个克制的候选标题，每行一个，不要编号、不要引号、不要解释。',
    user: (p) => `正文：\n${clip(p.content, 3000)}`,
    max: 120,
    temp: 0.8,
  },
  polish: {
    system:
      '你是中文编辑。在完全保留作者原意与语气的前提下润色：删冗余、顺语句、改错别字。不要添加内容、不要升华、不要写总结。只输出润色后的正文。',
    user: (p) => clip(p.content, 6000),
    max: 4000,
    temp: 0.7,
  },
  continue: {
    system:
      '你是中文写作者。顺着给定文字继续写两三段，人称、语气、节奏保持一致。不要总结、不要升华、不要用「总而言之」这类收尾。只输出续写的正文。',
    user: (p) => clip(p.content, 4000),
    max: 1200,
    temp: 0.85,
  },
};

async function aiAssist(kind: string, payload: any) {
  const task = AI_TASKS[kind];
  if (!task) throw new Error(`未知的 AI 任务：${kind}`);
  if (!AI_KEY) throw new Error('服务端未配置 AI Key（SUMMARY_API_KEY 或 DEEPSEEK_API_KEY）');

  const res = await fetch(`${AI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_KEY}` },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: task.system },
        { role: 'user', content: task.user(payload || {}) },
      ],
      max_tokens: task.max,
      temperature: task.temp,
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `AI 接口返回 ${res.status}`);
  const out = data?.choices?.[0]?.message?.content || '';
  return String(out)
    .trim()
    .replace(/^["'「【]+|["'」】]+$/g, '');
}

// ───────────────────────── 路由 ─────────────────────────

export async function OPTIONS() {
  return json({}, 200);
}

export async function POST({ request }: { request: Request }) {
  if (!authorize(request)) return json({ ok: false, error: '未授权：密码错误' }, 401);

  try {
    const q = await request.json();
    const action = String(q.action || '');

    if (action === 'list') {
      return json({ ok: true, posts: await listPosts() });
    }

    if (action === 'get') {
      if (!q.path) return json({ ok: false, error: '缺少 path' }, 400);
      const one = await getPost(String(q.path));
      return json({ ok: true, ...one });
    }

    // create 与 update 合并：靠 originalPath 区分，支持改写 slug 后自动清理旧文件
    if (action === 'save') {
      const title = String(q.title || '').trim();
      const content = String(q.content ?? '');
      if (!title) return json({ ok: false, error: '标题不能为空' }, 400);
      if (!content.trim()) return json({ ok: false, error: '正文不能为空' }, 400);

      const category = String(q.category || '随笔');
      let slug = String(q.slug || '')
        .trim()
        .replace(/[^\w-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      if (!slug) slug = `post-${Date.now()}`;

      const dir = categoryPath(category);
      const path = `${BLOG_DIR}/${dir}/${slug}.md`;
      const originalPath = q.originalPath ? String(q.originalPath) : '';

      const front = buildFrontmatter({
        title,
        link: slug,
        date: q.date || new Date().toISOString().slice(0, 19).replace('T', ' '),
        updated: q.updated || undefined,
        description: q.description || '',
        cover: q.cover || '',
        tags: Array.isArray(q.tags) ? q.tags.filter(Boolean) : [],
        categories: category ? [category] : [],
        sticky: !!q.sticky,
        draft: !!q.draft,
        catalog: q.catalog !== false,
      });

      const body = `${front}\n\n${content.replace(/^\s+/, '')}\n`;
      const saved = await writeText(path, body, originalPath ? `update: ${title}` : `add: ${title}`);

      // 路径变了（分类或 slug 改过），把旧文件删掉
      if (originalPath && originalPath !== path) {
        try {
          await removeFile(originalPath, `rename: ${slug}`);
        } catch {
          /* 旧文件已不存在则忽略 */
        }
      }

      return json({ ok: true, path, slug, url: saved?.content?.html_url || '' });
    }

    if (action === 'delete') {
      if (!q.path) return json({ ok: false, error: '缺少 path' }, 400);
      const file = String(q.path).split('/').pop() || '';
      await removeFile(String(q.path), `delete: ${file}`);
      return json({ ok: true });
    }

    if (action === 'upload') {
      const r = await uploadImage(String(q.name || ''), String(q.dataUrl || ''));
      return json({ ok: true, ...r });
    }

    if (action === 'ai') {
      const result = await aiAssist(String(q.kind || ''), { title: q.title, content: q.content });
      return json({ ok: true, result });
    }

    return json({ ok: false, error: `未知操作: ${action}` }, 400);
  } catch (e: any) {
    return json({ ok: false, error: e?.message || '服务器错误' }, 500);
  }
}
