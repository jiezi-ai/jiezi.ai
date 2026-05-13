import { useState, useEffect } from "react";

const API_BASE =
  (import.meta as any).env?.PUBLIC_API_URL || "https://api.jiezi.ai";

interface Student {
  name: string;
  school: string;
  major: string;
  batch: number;
  verified_at: string;
}

export default function StudentList() {
  const [students, setStudents] = useState<Student[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/api/students`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setStudents(data.students);
          setCount(data.count);
        }
      })
      .catch(() => {});
  }, []);

  if (count === 0) return null;

  return (
    <section className="mb-16">
      <div className="flex justify-between items-baseline mb-4">
        <h2 className="text-xl font-bold">已资助学生</h2>
        <span className="font-mono text-sm text-ink-muted">{count} 人</span>
      </div>
      <div className="border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-ink/[0.02]">
              <th className="text-left py-2.5 px-4 font-medium text-ink-muted">姓名</th>
              <th className="text-left py-2.5 px-4 font-medium text-ink-muted">学校</th>
              <th className="text-left py-2.5 px-4 font-medium text-ink-muted hidden md:table-cell">专业</th>
              <th className="text-left py-2.5 px-4 font-medium text-ink-muted">批次</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr
                key={i}
                className={i < students.length - 1 ? "border-b border-border/50" : ""}
              >
                <td className="py-2.5 px-4">{s.name}</td>
                <td className="py-2.5 px-4">{s.school}</td>
                <td className="py-2.5 px-4 hidden md:table-cell text-ink-muted">
                  {s.major || "—"}
                </td>
                <td className="py-2.5 px-4 font-mono text-ink-muted">
                  第 {s.batch} 批
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
