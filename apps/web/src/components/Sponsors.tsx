import { useState, useEffect } from "react";

const API = import.meta.env.PUBLIC_API_URL || "https://api.jieziai.cn";

interface Sponsor {
  name: string;
  amount: string;
  date: string;
  bio: string;
  avatar: string;
  link: string;
}

export default function Sponsors() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  useEffect(() => {
    fetch(`${API}/api/sponsors`)
      .then((r) => r.json())
      .then((data) => setSponsors(data.sponsors || []))
      .catch(() => {});
  }, []);

  if (sponsors.length === 0) return null;

  return (
    <section className="mb-24">
      <div className="mb-8">
        <h2 className="text-xl font-bold font-serif">赞助方</h2>
      </div>

      <div className="space-y-4">
        {sponsors.map((s) => (
          <a
            key={s.name}
            href={s.link}
            target="_blank"
            rel="noopener"
            className="flex items-center gap-4 border border-border p-4 hover:border-vermillion transition-colors group"
          >
            <img
              src={s.avatar}
              alt={s.name}
              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-serif font-bold text-sm group-hover:text-vermillion">
                  {s.name}
                </span>
                <span className="font-mono text-vermillion text-sm">{s.amount}</span>
              </div>
              <p className="text-xs text-ink-muted mt-0.5 truncate">{s.bio}</p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
