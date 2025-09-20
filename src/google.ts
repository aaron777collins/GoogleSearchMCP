import fetch from "cross-fetch";
import type { GoogleResult } from "./types.js";

const API = "https://www.googleapis.com/customsearch/v1";
const key = process.env.GOOGLE_API_KEY || "";
const cx = process.env.GOOGLE_CX || "";

export async function googleSearch(query: string, opts?: {
  num?: number; // 1..10 per page (API limit)
  start?: number; // 1-indexed start
  safe?: "off" | "active" | "high";
  searchType?: "image" | undefined;
}) {
  if (!key || !cx) throw new Error("Missing GOOGLE_API_KEY or GOOGLE_CX");
  const params = new URLSearchParams({ key, cx, q: query });
  if (opts?.num) params.set("num", String(Math.min(Math.max(opts.num, 1), 10)));
  if (opts?.start) params.set("start", String(Math.max(opts.start, 1)));
  if (opts?.safe) params.set("safe", opts.safe);
  if (opts?.searchType) params.set("searchType", opts.searchType);

  const res = await fetch(`${API}?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const items: GoogleResult[] = (data.items || []).map((it: any) => ({
    title: it.title,
    link: it.link,
    snippet: it.snippet,
    displayLink: it.displayLink,
    mime: it.mime,
    image: it.image
  }));
  const nextStart: number | undefined = data.queries?.nextPage?.[0]?.startIndex;
  return { items, nextStart, raw: data } as const;
}
