import fs from 'node:fs/promises';
import path from 'node:path';

const API_KEY = process.env.DEEPSEEK_API_KEY;
const OUT = 'src/content/blog';

const TOPICS = [
  { dir:'life', slug:'night-phone', title:'深夜的手机屏幕', cats:['随笔'], tags:['随笔','生活'], brief:'高三的深夜，手机屏幕的微光，和第二天六点的闹钟' },
  { dir:'life', slug:'last-hour-of-weekend', title:'周末的最后一小时', cats:['随笔'], tags:['随笔','生活'], brief:'周六下午五点放学后那点短暂的自由，和它结束时的感觉' },
  { dir:'life', slug:'summer-noise', title:'电子噪音', cats:['随笔'], tags:['随笔','电波'], brief:'夏天、耳机、电子噪音，和一种说不清的情绪' },
  { dir:'life/anime', slug:'subahibi-review', title:'《素晴日》：日常下面埋着的东西', cats:['随笔','番剧'], tags:['Galgame','感想','素晴日'], brief:'对《素晴日》的感想——世界看起来正常，越往下挖越不正常' },
  { dir:'life/anime', slug:'atri-dear-moments', title:'《ATRI》和回不去的时间', cats:['随笔','番剧'], tags:['Galgame','感想','ATRI'], brief:'对《ATRI -My Dear Moments-》的感想，关于时间和告别' },
  { dir:'life/anime', slug:'saya-no-uta', title:'《沙耶之歌》里的"正常"', cats:['随笔','番剧'], tags:['Galgame','感想','沙耶之歌'], brief:'读《沙耶之歌》后对"正常"与"怪物"的思考' },
  { dir:'life/anime', slug:'another-world-anime', title:'为什么总是"另一个世界"', cats:['随笔','番剧'], tags:['Galgame','番剧','随想'], brief:'关于平行世界、存档、另一个自己这类作品为什么吸引人' },
  { dir:'tools', slug:'iphone-root-days', title:'把 iPhone 折腾到 Root 的那几天', cats:['工具'], tags:['工具','折腾','iPhone'], brief:'折腾 iPhone 的经历，从失败到跑通的记录' },
  { dir:'tools', slug:'proxy-history', title:'我的网络代理折腾史', cats:['工具'], tags:['工具','网络','代理'], brief:'从 Quantumult X 到 Mihomo 的折腾经历' },
  { dir:'tools', slug:'phone-ai-agent', title:'想在手机上做一个 AI Agent', cats:['工具'], tags:['工具','AI','折腾'], brief:'想用手机做一个属于自己的 AI Agent 的想法和尝试' },
  { dir:'tools', slug:'my-blog-build', title:'这个博客是怎么来的', cats:['工具'], tags:['工具','博客','前端'], brief:'搭这个博客的过程和想法' },
  { dir:'note', slug:'if-life-could-save', title:'如果人生可以存档', cats:['笔记'], tags:['笔记','随想','电波'], brief:'关于"如果人生可以存档/读档"的胡思乱想' },
  { dir:'note', slug:'who-am-i', title:'关于"我是谁"这个问题', cats:['笔记'], tags:['笔记','随想','哲学'], brief:'半夜突然想到的关于自我、记忆、存在的疑惑' },
  { dir:'note', slug:'why-music', title:'为什么音乐能让人逃出去', cats:['笔记'], tags:['笔记','音乐','随想'], brief:'音乐为什么能从现实里短暂逃出去' },
];

const SYSTEM = `你是一个中国高三学生的博客写作者，替这个学生写博客文章。

这个学生：高三，早上6:20去学校，晚上22:15结束学习。讨厌考试，考差了会低落。喜欢二次元、Galgame、视觉小说、哲学、梦境、电波文学。喜欢《素晴日》、KeroQ、《终之空》、《沙耶之歌》、《ATRI》。喜欢周杰伦、EXO、林俊杰。喜欢折腾 iPhone、Root、网络代理、AI、网站。

写作要求：
1. 像一个真实高中生写的，不要"优秀作文"，不要鸡汤，不要励志。
2. 不要过度文学化，不要堆砌"斑驳的月光""孤独的灵魂"这类词。用真实的小东西：校服、试卷、晚自习、耳机、手机电量、夜路、台灯。
3. 允许有抱怨、疲惫、无聊、突然跑题。允许不完整的句子。文章结尾不要每次都升华。
4. 偶尔可以突然变得哲学，但要像一个高中生突然想到的，然后被现实打断。
5. 绝对不要出现 AI 腔：不要"作为一名高中生"、不要标准三段式、不要"首先其次最后"。
6. 长度 200-500 字。
7. 输出格式：第一行是标题（不要加 # 或 ** 等标记），从第二行开始是正文。不要输出任何解释。`;

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
