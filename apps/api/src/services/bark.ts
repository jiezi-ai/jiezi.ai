export async function notifyBark(
  barkKey: string,
  title: string,
  markdown: string,
  opts?: { group?: string; icon?: string; url?: string; level?: string },
): Promise<boolean> {
  try {
    const res = await fetch("https://api.day.app/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_key: barkKey,
        title,
        markdown,
        group: opts?.group ?? "jiezi",
        icon: opts?.icon ?? "https://jiezi.ai/favicon.svg",
        url: opts?.url,
        level: opts?.level ?? "active",
        isArchive: "1",
      }),
    });
    if (!res.ok) {
      console.error(`[bark] push failed: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e: any) {
    console.error(`[bark] push error:`, e);
    return false;
  }
}
