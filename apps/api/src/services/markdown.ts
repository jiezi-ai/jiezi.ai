export function extractTitle(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

export function parseMarkdownTable(
  markdown: string,
): Array<Record<string, string>> {
  const lines = markdown.split("\n");
  const rows: Array<Record<string, string>> = [];
  let headers: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;

    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

    if (cells.every((c) => /^[-:]+$/.test(c))) continue;

    if (headers.length === 0) {
      headers = cells;
    } else {
      const row: Record<string, string> = {};
      cells.forEach((cell, i) => {
        if (headers[i]) row[headers[i]] = cell;
      });
      rows.push(row);
    }
  }

  return rows;
}
