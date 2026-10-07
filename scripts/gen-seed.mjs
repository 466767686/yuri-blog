import fs from 'node:fs/promises';
import path from 'node:path';

const API_KEY = process.env.DEEPSEEK_API_KEY;
const OUT = 'src/content/blog';

const TOPICS = [
  { dir:'life', slug:'night-phone', title:'深夜的手机屏幕', cats:['随笔'], tags:['随笔','生活'], brief:'高三深夜，手机微光，第二天六点的闹钟。纯生活，不提游戏动漫' },
  { dir:'life', slug:'last-hour-of-weekend', title:'周末的最后一小时', cats:['随笔'], tags:['随笔','生活'], brief:'周六下午五点放学后那点短暂自由，以及它结束时的感觉。纯生活' },
  { dir:'life', slug:'ordinary-wednesday', title:'一个普通的周三', cats:['随笔'], tags:['随笔','生活'], brief:'一天完全重复的上学生活，没发生什么大事。纯生活' },
  { dir:'life', slug:'morning-self-study', title:'早读', cats:['随笔'], tags:['随笔','生活'], brief:'早上六点多到校的早读，困、发呆、背不进去。纯生活' },
  { dir:'life', slug:'rainy-way-home', title:'下雨的放学路', cats:['随笔'], tags:['随笔','生活'], brief:'下雨天的放学路上的一些观察和心情。纯生活' },
  { dir:'life/anime', slug:'subahibi-review', title:'《素晴日》：日常下面埋着的东西', cats:['随笔','番剧'], tags:['Galgame','感想','素晴日'], brief:'对《素晴日》本身的感想（这篇主题就是这部作品）' },
  { dir:'life/anime', slug:'atri-dear-moments', title:'《ATRI》和回不去的时间', cats:['随笔','番剧'], tags:['Galgame','感想','ATRI'], brief:'对《ATRI》本身的感想（这篇主题就是这部作品）' },
  { dir:'tools', slug:'iphone-root-days', title:'把 iPhone 折腾到 Root 的那几天', cats:['工具'], tags:['工具','折腾','iPhone'], brief:'折腾 iPhone 的经历。纯技术，不提游戏' },
  { dir:'tools', slug:'proxy-history', title:'我的网络代理折腾史', cats:['工具'], tags:['工具','网络','代理'], brief:'从 Quantumult X 到 Mihomo 的折腾经历。纯技术' },
  { dir:'tools', slug:'phone-ai-agent', title:'想在手机上做一个 AI Agent', cats:['工具'], tags:['工具','AI','折腾'], brief:'想用手机做 AI Agent 的想法和尝试。纯技术' },
  { dir:'tools', slug:'my-blog-build', title:'这个博客是怎么来的', cats:['工具'], tags:['工具','博客','前端'], brief:'搭这个博客的过程。纯技术' },
  { dir:'note', slug:'if-life-could-save', title:'如果人生可以存档', cats:['笔记'], tags:['笔记','随想'], brief:'关于"如果人生可以存档"的胡思乱想。纯思考，不扯具体游戏作品' },
  { dir:'note', slug:'why-music', title:'为什么音乐能让人逃出去', cats:['笔记'], tags:['笔记','音乐','随想'], brief:'音乐为什么能从现实里短暂逃出去。不提游戏' },
  { dir:'note', slug:'tired-repeat', title:'重复的日子', cats:['笔记'], tags:['笔记','随想'], brief:'关于每天重复同样生活的感受。不提游戏或动漫' },
];

const SYSTEM = `你是一个中国高三学生的博客写作者，替他写博客。

这个学生：高三，早上6:20出门，晚上22:15结束。讨厌考试但也在乎分数。喜欢音乐。喜欢折腾手机、网络、AI、网站。

写作要求：
1. 像一个真实高中生随手写的，不要"优秀作文"，不要鸡汤，不要励志。
2. 不要过度文学化。用真实的小东西：校服、试卷、晚自习、耳机、手机电量、夜路、台灯、闹钟。
3. 允许抱怨、疲惫、无聊、跑题、不完整的句子。结尾不要每次都升华。
4. 偶尔可以突然哲学，但要像高中生突然想到的，然后被现实打断。
5. 绝对不要 AI 腔：不要"作为一名高中生"，不要标准三段式，不要"首先其次最后"。

【最重要】每篇文章只写它自己的主题。
不要强行提及 galgame、二次元作品、或者其他和当前主题无关的爱好。
除非文章主题本身就是关于它们（比如标题就是某部作品），否则全文不应出现这类内容。
生活类文章就老老实实写生活，技术类文章就老老实实写技术。

6. 长度 200-450 字。
7. 输出格式：第一行是标题（不加 # 或 **），从第二行开始正文。不要任何解释。`;

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
