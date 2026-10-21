export const prerender = false;

const CLIENT_ID = String(import.meta.env.GOOGLE_CLIENT_ID || '');
const CLIENT_SECRET = String(import.meta.env.GOOGLE_CLIENT_SECRET || '');
const SITE = 'https://www.132778.xyz';
const REDIRECT = `${SITE}/api/drive-auth`;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

const CSS = `*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;
background:#faf7f8;color:#241a1e;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;padding:24px}
main{background:#fff;border-radius:16px;padding:28px 24px;max-width:440px;width:100%;box-shadow:0 8px 32px -20px rgba(60,30,40,.35)}
h1{font-size:19px;margin:0 0 8px}p{font-size:13.5px;line-height:1.7;color:#6b5c62;margin:0 0 14px}
a.btn{display:block;text-align:center;background:#e9536a;color:#fff;text-decoration:none;padding:11px;border-radius:9px;font-size:14px}
code{display:block;word-break:break-all;background:#f4eef0;border-radius:8px;padding:11px;font-size:12.5px;margin:10px 0;user-select:all}
.ok{color:#1a7f4b;font-weight:600}.bad{color:#c0392b;font-weight:600}`;

function html(title: string, body: string) {
  return new Response(
    `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>${CSS}</style></head><body><main>${body}</main></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
}

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  const code = url.searchParams.get('code');

  if (error) {
    return html('授权被取消', `<h1 class="bad">授权没有完成</h1><p>Google 返回：${error}。可以重新打开这个页面再试一次。</p>`);
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return html(
      '还没配置',
      `<h1>还差两步配置</h1><p>请先在 Vercel 项目的环境变量里填好 <b>GOOGLE_CLIENT_ID</b> 和 <b>GOOGLE_CLIENT_SECRET</b>，再重新部署，然后回到这里授权。</p>`,
    );
  }

  if (!code) {
    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    auth.searchParams.set('client_id', CLIENT_ID);
    auth.searchParams.set('redirect_uri', REDIRECT);
    auth.searchParams.set('response_type', 'code');
    auth.searchParams.set('scope', SCOPE);
    auth.searchParams.set('access_type', 'offline');
    auth.searchParams.set('prompt', 'consent');
    return html(
      '连接 Google Drive',
      `<h1>连接你的 Google Drive</h1>
       <p>点下面的按钮，用你自己的 Google 账号登录并同意授权。程序只会访问它自己创建的文件，不会碰你网盘里原有的内容。</p>
       <a class="btn" href="${auth.toString()}">去授权</a>`,
    );
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: 'authorization_code',
    }),
  });
  const data: any = await tokenRes.json().catch(() => ({}));

  if (!tokenRes.ok) {
    const detail = data?.error_description || data?.error || `HTTP ${tokenRes.status}`;
    return html(
      '授权失败',
      `<h1 class="bad">换取令牌失败</h1><p>${detail}</p><p>常见原因：重定向 URI 和 Google 控制台里填的不完全一致，或 Client Secret 填错了。</p>`,
    );
  }

  const refreshToken = String(data.refresh_token || '');
  if (!refreshToken) {
    return html(
      '没有拿到长期令牌',
      `<h1 class="bad">Google 没有返回 refresh token</h1>
       <p>这通常是因为这个应用之前已经授权过。请到 Google 账号的「第三方应用和数据」里删除本应用的授权，然后重新打开这个页面授权一次。</p>`,
    );
  }

  return html(
    '授权成功',
    `<h1 class="ok">授权成功</h1>
     <p>把下面这串内容复制到 Vercel 项目的环境变量 <b>GOOGLE_REFRESH_TOKEN</b> 里，然后 Redeploy 一次。它等于你网盘的长期访问凭证，不要发给别人。</p>
     <code id="rt">${refreshToken}</code>
     <p><button onclick="navigator.clipboard.writeText(document.getElementById('rt').textContent).then(()=>this.textContent='已复制')" style="padding:9px 16px;border-radius:9px;border:1px solid #e9536a;background:#fff;color:#e9536a;font:inherit">复制</button></p>
     <p>填好后打开 <a href="/admin/files.html">文件柜</a> 上传文件试试。</p>`,
  );
}
