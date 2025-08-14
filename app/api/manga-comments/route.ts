 // app/api/manga-comments/route.ts
 import { NextRequest, NextResponse } from 'next/server';
 import { createServerClient, type CookieOptions } from '@supabase/ssr';
 
 // помощник: переносим Set-Cookie из одного ответа в другой
 function withCookies(from: NextResponse, to: NextResponse) {
   const set = from.headers.get('set-cookie');
   if (set) to.headers.append('set-cookie', set);
   return to;
 }
 
 export async function POST(req: NextRequest) {
   // сюда Supabase будет писать обновлённые cookie
   const cookieRes = new NextResponse();
 
   const supabase = createServerClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
     {
       cookies: {
         // читаем из запроса
         get(name: string) {
           return req.cookies.get(name)?.value;
         },
         // пишем в ответ (ВАЖНО!)
         set(name: string, value: string, options: CookieOptions) {
           cookieRes.cookies.set({ name, value, ...options });
         },
         remove(name: string, options: CookieOptions) {
           cookieRes.cookies.set({ name, value: '', ...options, maxAge: 0 });
         },
       },
     }
   );
 
   // авторизация
   const { data: auth } = await supabase.auth.getUser();
   if (!auth?.user) {
     return withCookies(
       cookieRes,
       NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
     );
   }
 
   // читаем и валидируем тело
   const body = await req.json().catch(() => ({}));
   const mangaId = Number(body?.mangaId);
   const content = String(body?.content ?? '').trim();
 
   if (!Number.isFinite(mangaId) || !content) {
     return withCookies(
       cookieRes,
       NextResponse.json({ error: 'Плохие данные' }, { status: 400 })
     );
   }
 
   // запись комментария (если нужны постраничные — поменяйте на page_comments/page_id)
   const { data, error } = await supabase
     .from('manga_comments')
     .insert({ manga_id: mangaId, user_id: auth.user.id, content })
     .select('id')
     .maybeSingle();
 
   if (error) {
     return withCookies(
       cookieRes,
       NextResponse.json({ error: error.message }, { status: 500 })
     );
   }
 
   return withCookies(
     cookieRes,
     NextResponse.json({ ok: true, id: data?.id }, { status: 200 })
   );
 }
 