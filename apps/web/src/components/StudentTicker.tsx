import { useState, useEffect } from "react";

const API_BASE =
  (import.meta as any).env?.PUBLIC_API_URL || "https://api.jiezi.ai";

interface Student {
  name: string;
  school: string;
  major: string;
  batch: number;
}

export default function StudentTicker() {
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/students`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.students?.length) setStudents(data.students);
      })
      .catch(() => {});
  }, []);

  if (students.length === 0) return null;

  const items = [...students, ...students];
  const duration = Math.max(students.length * 4, 15);

  return (
    <>
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <div className="overflow-hidden border-t border-border py-3">
        <div
          style={{
            display: "flex",
            gap: "2rem",
            whiteSpace: "nowrap",
            animation: `ticker-scroll ${duration}s linear infinite`,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.animationPlayState = "paused"; }}
          onMouseLeave={(e) => { e.currentTarget.style.animationPlayState = "running"; }}
        >
          {items.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-2 text-xs text-ink-muted flex-shrink-0">
              <span className="font-medium text-ink">{s.name}</span>
              <span>{s.school}</span>
              {s.major && <span>· {s.major}</span>}
              <span className="font-mono text-[10px]">第{s.batch}批</span>
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
