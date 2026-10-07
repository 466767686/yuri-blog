export const prerender = false;

const STEAM_API_KEY = import.meta.env.STEAM_API_KEY || '';
const STEAM_ID = import.meta.env.STEAM_ID || '';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}

export async function GET() {
  if (!STEAM_API_KEY || !STEAM_ID) {
    return json({ ok: false, error: 'Steam 未配置（缺少 STEAM_API_KEY 或 STEAM_ID）' }, 500);
  }
  try {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${STEAM_ID}&include_appinfo=true&include_played_free_games=true&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    const rawGames = data.response?.games || [];
    const games = rawGames
      .map((g: any) => ({
        appid: g.appid,
        name: g.name,
        playtime: g.playtime_forever || 0,
        playtime2w: g.playtime_2weeks || 0,
        cover: `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/header.jpg`,
      }))
      .sort((a: any, b: any) => b.playtime - a.playtime);
    return json({ ok: true, total: games.length, games });
  } catch (e: any) {
    return json({ ok: false, error: e.message || 'Steam API 错误' }, 500);
  }
}
