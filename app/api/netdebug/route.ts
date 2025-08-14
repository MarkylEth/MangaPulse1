import { NextResponse } from "next/server";

export async function GET() {
  const token = (process.env.YANDEX_DISK_OAUTH || "").trim();
  const out: any = { tokenLen: token.length };

  async function ping(name: string, url: string, headers?: Record<string,string>) {
    try {
      const r = await fetch(url, { headers, cache: "no-store" as const });
      out[name] = { status: r.status };
      if (!r.ok) out[name].body = await r.text().catch(() => "");
    } catch (e: any) {
      out[name] = { error: String(e?.message || e) };
    }
  }

  await ping("google", "https://www.google.com");
  await ping("yandex_meta", "https://cloud-api.yandex.net/v1/disk", { Authorization: `OAuth ${token}` });

  return NextResponse.json(out);
}
     