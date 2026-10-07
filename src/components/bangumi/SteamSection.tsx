import { useEffect, useState } from 'react';

interface SteamGame {
  appid: number;
  name: string;
  playtime: number;
  playtime2w?: number;
  cover: string;
}

export function SteamSection() {
  const [games, setGames] = useState<SteamGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/steam')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.ok) setGames(d.games || []);
        else setError(d.error || 'Steam 加载失败');
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="py-4 text-muted-foreground text-sm">Steam 游戏加载中…</p>;
  if (error || games.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm">Steam 游戏库</span>
        <span className="text-muted-foreground text-xs">共 {games.length} 款</span>
      </div>
      <div className="bangumi-grid">
        {games.map((g) => (
          <a
            key={g.appid}
            href={`https://store.steampowered.com/app/${g.appid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bangumi-card group"
          >
            <div className="bangumi-poster">
              <img src={g.cover} alt="" loading="lazy" decoding="async" />
            </div>
            <h3 className="bangumi-title" title={g.name}>
              {g.name}
            </h3>
            <p className="bangumi-meta">
              <span>{Math.round(g.playtime / 60)} 小时</span>
              {(g.playtime2w ?? 0) > 0 && <span>近两周 {Math.round((g.playtime2w || 0) / 60)}h</span>}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
