import { NextResponse } from "next/server";

export async function GET() {
  const sr = (process.env.SUPABASE_SERVICE_ROLE || "").trim();
  return NextResponse.json({
    cwd: process.cwd(),         // откуда запущен Next
    sr_len: sr.length,          // должно быть > 100
    sr_head: sr.slice(0, 10),   // начало ключа (безопасно)
  });
}
