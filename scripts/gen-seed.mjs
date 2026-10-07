import fs from 'node:fs/promises';
import path from 'node:path';

const API_KEY = process.env.DEEPSEEK_API_KEY;
const OUT = 'src/content/blog';

const TOPICS = [
  { dir:'life', slug:'night-phone', title:'深夜的手机屏幕', cats:['随笔'], tags:['随笔','生活'], brief:'高三深夜，手机屏幕的光，和第二天六点的闹钟。纯生活' },
  { dir:'life', slug:'saturday-5pm', title:'周六下午五点', cats:['随笔'], tags:['随笔','生活'], brief:'周六下午放学后那点短暂的自由。纯生活' },
  { dir:'life', slug:'morning-self-study', title:'早读', cats:['随笔'], tags:['随笔','生活'], brief:'早读犯困、发呆、背不进去。纯生活' },
  { dir:'life', slug:'rainy-way-home', title:'下雨的放学路', cats:['随笔'], tags:['随笔','生活'], brief:'下雨天放学路上的观察。纯生活' },
  { dir:'life', slug:'tired-repeat', title:'重复的日子', cats:['随笔'], tags:['随笔','生活'], brief:'每天重复同样生活的疲惫。纯生活' },
  { dir:'life', slug:'after-exam', title:'考完试的那个下午', cats:['随笔'], tags:['随笔','生活'], brief:'考完一场试之后的松懈和空落。不要编造分数名次' },
  { dir:'tools', slug:'proxy-story', title:'折腾网络这件事', cats:['工具'], tags:['工具','网络'], brief:'折腾网络代理的经历。只能用 Quantumult X、Mihomo/Clash' },
  { dir:'tools', slug:'phone-broken', title:'把手机折腾坏了', cats:['工具'], tags:['工具','折腾','iPhone'], brief:'折腾手机搞坏了又救回来。不要编造具体插件名' },
  { dir:'life/anime', slug:'subahibi', title:'《素晴日》', cats:['随笔','番剧'], tags:['Galgame','感想','素晴日'], brief:'玩完《素晴日》之后的感想' },
  { dir:'life/anime', slug:'atri', title:'《ATRI》', cats:['随笔','番剧'], tags:['Galgame','感想','ATRI'], brief:'玩完《ATRI》之后的感想' },
];

const SYSTEM = `你是一个中国高三学生的博客写作者，替他写随笔。

【这个人】
高三。早上6:20出门，晚上22:15结束，周六下午五点放学。
讨厌考试，也怕考不好。喜欢音乐。喜欢折腾手机和网络。

【写作要求 - 严格遵守】
1. 像真人随手写的日记，不像作文。允许句子短、碎、不完整。
2. 【禁止虚构】不要编造具体信息：
   - 地名、学校名、同学名、老师名
   - 商品品牌、平台名、网站名
   - 具体的软件、配置、技术方案
   不知道就模糊处理（"某个软件""一个网站"），或干脆不提。
3. 【禁止 AI 腔】
   - 不要"我突然想到""这让我明白""也许这就是青春"
   - 不要工整的排比、不要华丽的比喻
   - 不要结尾升华、不要总结人生
4. 多用真实的小动作小物件：手机电量、耳机、校服、试卷、台灯、闹钟。
5. 可以抱怨、发呆、跑题、自嘲。允许什么都没解决。
6. 长度 150-350 字，不要长。
7. 输出格式：第一行标题（不加任何标记），第二行开始正文。

【技术类文章】
只准用这些真实的工具：iPhone 折腾/越狱/Root、Quantumult X、Mihomo(Clash) 这类网络代理。
不确定的一律不写。

【绝对禁止写】
- 用什么搭的博客（Hexo/Astro/WordPress 一律不提）
- 域名在哪买、多少钱、什么后缀
- 服务器、云服务商、nginx
- 任何你可能编造的"事实"`;

function fm(t, title){ return ['---', 'title: ' + JSON.stringify(title), 'link: ' + t.slug, 'date: ' + t.date + ' 20:00:00', 'catalog: true', 'tags:', ...t.tags.map(x=>'  - '+x), 'categories:', ...t.cats.map(x=>'  - '+x), '---'].join('\n'); }
function daysAgo(n){ const d=new Date(Date.now()-n*86400000); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

let i = 0;
for (const t of TOPICS){
  i++;
  t.date = daysAgo(TOPICS.length - i + 1);
  process.stdout.write('[' + i + '/' + TOPICS.length + '] ' + t.title + ' ... ');
  try{
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + API_KEY },
      body: JSON.stringify({
        model:'deepseek-chat',
        messages:[
          { role:'system', content: SYSTEM },
          { role:'user', content: '请写一篇题为《' + t.title + '》的博客文章。主题方向：' + t.brief }
        ],
        temperature: 1.2, max_tokens: 1200,
      }),
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data && data.error ? data.error.message : res.status);
    const out = (data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '').trim();
    const lines = out.split('\n');
    const title = lines[0].replace(/^#+\s*/,'').replace(/\*\*/g,'').replace(/^标题[:：]\s*/,'').trim();
    const body = lines.slice(1).join('\n').trim();
    const file = path.join(OUT, t.dir, t.slug + '.md');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, fm(t, title) + '\n' + body + '\n');
    console.log('OK');
  }catch(e){
    console.log('FAIL: ' + e.message);
  }
}
console.log('全部完成');
