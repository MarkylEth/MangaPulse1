import { NextResponse } from "next/server";

const API = "https://cloud-api.yandex.net/v1/disk";

export async function GET() {
  const token = (process.env.YANDEX_DISK_OAUTH || "").trim();
  const tokenLen = token.length;

  // 1) ping метаданных диска
  let metaStatus = 0;
  try {
    const r = await fetch(API, { headers: { Authorization: `OAuth ${token}` } });
    metaStatus = r.status;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, step: "meta", error: String(e?.message || e), tokenLen },
      { status: 500 }
    );
  }

  // 2) пробуем создать тестовую папку в app:/ (для токена app_folder)
  const testPath = `app:/mangapulse/_debug_${Date.now()}`;
  let ensureStatus = 0;
  let ensureBody = "";
  try {
    const u = `${API}/resources?path=${encodeURIComponent(testPath)}`;
    const r = await fetch(u, {
      method: "PUT",
      headers: { Authorization: `OAuth ${token}` },
    });
    ensureStatus = r.status;
    if (!r.ok && r.status !== 409) {
      ensureBody = await r.text().catch(() => "");
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, step: "ensure", error: String(e?.message || e), tokenLen, metaStatus },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    tokenLen,
    metaStatus,          // ожидаем 200
    ensureStatus,        // 201 или 409 — ОК; иное — проблема прав/токена
    ensureBody,
  });
}
