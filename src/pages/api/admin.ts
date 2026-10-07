export const prerender = false;

const OWNER = import.meta.env.GH_OWNER || '466767686';
const REPO = import.meta.env.GH_REPO || 'yuri-blog';
const BRANCH = 'main';
const ADMIN_PASSWORD = import.meta.env.ADMIN_PASSWORD || '';
const CATEGORY_MAP: Record<string,string> = { '随笔':'life', '笔记':'note', '工具':'tools', '周刊':'weekly', '前端':'note/front-end', '番剧':'life/anime' };

function json(data:any, status=200){
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers':'Content-Type,Authorization' },
  });
}

function authorize(request: Request){
  const t = request.headers.get('authorization') || '';
  const p = t.replace(/^Bearer\s+/i, '');
  return !!ADMIN_PASSWORD && p === ADMIN_PASSWORD;
}

async function github(path:string, opts:any={}){
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
  const headers:any = {
    'Authorization': `Bearer ${import.meta.env.GH_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if(opts.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let data:any; try{ data = JSON.parse(text); }catch{ data = text; }
  if(!res.ok) throw new Error(data?.message || `GitHub API ${res.status}`);
  return data;
}

function buildFrontmatter(o:any){
  const lines = ['---', `title: ${JSON.stringify(o.title)}`, `link: ${o.link}`];
  if(o.date) lines.push(`date: ${o.date}`);
  if(o.description) lines.push(`description: ${JSON.stringify(o.description)}`);
  lines.push('catalog: true');
  if(o.tags && o.tags.length){ lines.push('tags:'); o.tags.forEach((t:string)=>lines.push(`  - ${t}`)); }
  if(o.categories && o.categories.length){ lines.push('categories:'); o.categories.forEach((c:string)=>lines.push(`  - ${c}`)); }
  lines.push('---'); return lines.join('\n');
}
function categoryPath(c:string){ return CATEGORY_MAP[c] || 'life'; }

export async function OPTIONS(){
  return json({}, 200);
}

export async function POST({ request }: { request: Request }){
  if(!authorize(request)) return json({ ok:false, error:'未授权：密码错误' }, 401);
  try{
    const q = await request.json();
    const { action, title, link, category, tags, description, content, date } = q;

    if(action === 'list'){
      const tree = await github('src/content/blog');
      const posts = (Array.isArray(tree)?tree:[]).map((f:any)=>({ name:f.name, path:f.path, type:f.type }));
      return json({ ok:true, posts });
    }

    if(action === 'create'){
      if(!title || !content) return json({ ok:false, error:'标题和正文不能为空' }, 400);
      const safeLink = (link || `post-${Date.now()}`).replace(/[^\w\-]/g, '-');
      const dir = categoryPath(category);
      const path = `src/content/blog/${dir}/${safeLink}.md`;
      const body = buildFrontmatter({ title, link:safeLink, date:date || new Date().toISOString().slice(0,10)+' 00:00:00', tags:tags||[], categories:category?[category]:[], description }) + '\n' + content;
      const data = await github(path, { method:'PUT', body: JSON.stringify({ message:`add: ${title}`, content: Buffer.from(body,'utf8').toString('base64'), branch: BRANCH }) });
      return json({ ok:true, path, url: data.content?.html_url });
    }

    if(action === 'update'){
      if(!title || !content) return json({ ok:false, error:'标题和正文不能为空' }, 400);
      const dir = categoryPath(category);
      const path = `src/content/blog/${dir}/${link}.md`;
      const existing = await github(path);
      const body = buildFrontmatter({ title, link, date:date || new Date().toISOString().slice(0,10)+' 00:00:00', tags:tags||[], categories:category?[category]:[], description }) + '\n' + content;
      const data = await github(path, { method:'PUT', body: JSON.stringify({ message:`update: ${title}`, content: Buffer.from(body,'utf8').toString('base64'), sha: existing.sha, branch: BRANCH }) });
      return json({ ok:true, path, url: data.content?.html_url });
    }

    if(action === 'delete'){
      if(!link) return json({ ok:false, error:'缺少 link' }, 400);
      const dir = categoryPath(category);
      const path = `src/content/blog/${dir}/${link}.md`;
      const existing = await github(path);
      await github(path, { method:'DELETE', body: JSON.stringify({ message:`delete: ${link}`, sha: existing.sha, branch: BRANCH }) });
      return json({ ok:true, path });
    }

    return json({ ok:false, error:`未知操作: ${action}` }, 400);
  }catch(e:any){
    return json({ ok:false, error: e.message || '服务器错误' }, 500);
  }
}
