import fs from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const dir = path.join(process.cwd(), "public", "banners");
    const files = (await fs.readdir(dir))
      .filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f))
      .sort();

    const items = files.map((f, i) => ({
      id: i + 1,
      title: f.replace(/\.[^.]+$/, ""),
      coverUrl: `/banners/${f}`,
      href: `/manga/${i + 1}`, // при желании подставь свою логику
    }));

    return Response.json(items);
  } catch (e) {
    console.error(e);
    return Response.json([], { status: 200 });
  }
}
