// 일본 유튜브트랜드 — 롱폼·쇼츠 인기 (국가 복제: MARKET=jp|kr …)
import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "url";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const marketId = (process.env.MARKET || "jp").toLowerCase();
const marketMod = await import(
  pathToFileURL(path.join(__dirname, "markets", `${marketId}.mjs`)).href
);
const market = marketMod.market || marketMod.default;

const YT_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

if (!YT_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "[중단] 환경변수(YOUTUBE_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)가 없습니다."
  );
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const REGION = market.regionCode;
const RELEVANCE_LANG = market.relevanceLanguage;
const CONTINENT = market.continent;
const SHORTS_MAX_SEC = market.shortsMaxSec || 60;
const KIND_LONG = market.kinds.long;
const KIND_SHORTS = market.kinds.shorts;

const CATEGORY_ID_TO_KEY = {
  10: "music",
  23: "comedy",
  15: "animals",
  26: "howto",
  22: "people",
  27: "education",
  24: "ent",
  1: "film",
  17: "sports",
  25: "news",
  28: "science",
  20: "gaming",
  19: "travel",
  2: "autos",
};

function parseNum(n) {
  return parseInt(n || "0", 10);
}

function parseDurationSec(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!m) return 0;
  return (
    parseInt(m[1] || "0", 10) * 3600 +
    parseInt(m[2] || "0", 10) * 60 +
    parseInt(m[3] || "0", 10)
  );
}

function trueCategoryOf(v) {
  return CATEGORY_ID_TO_KEY[v.snippet?.categoryId] || null;
}

function toRow(v, i) {
  return {
    video_id: v.id,
    title: v.snippet?.title || "",
    channel: v.snippet?.channelTitle || "",
    channel_id: v.snippet?.channelId || "",
    published_at: v.snippet?.publishedAt || null,
    thumbnail_url: v.snippet?.thumbnails?.medium?.url || "",
    view_count: parseNum(v.statistics?.viewCount),
    like_count: parseNum(v.statistics?.likeCount),
    comment_count: parseNum(v.statistics?.commentCount),
    country_code: REGION,
    continent: CONTINENT,
    category_key: "all",
    true_category: trueCategoryOf(v),
    license: "youtube",
    rank: i + 1,
    youtube_url: `https://www.youtube.com/watch?v=${v.id}`,
  };
}

async function ytJson(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data;
}

async function fetchMostPopular() {
  const url =
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails` +
    `&chart=mostPopular&regionCode=${REGION}&maxResults=50&key=${YT_KEY}`;
  const data = await ytJson(url);
  return data.items || [];
}

async function fetchShortsPopular() {
  const searchUrl =
    `https://www.googleapis.com/youtube/v3/search?part=snippet` +
    `&type=video&videoDuration=short&order=viewCount` +
    `&regionCode=${REGION}&relevanceLanguage=${RELEVANCE_LANG}` +
    `&maxResults=50&key=${YT_KEY}`;
  const search = await ytJson(searchUrl);
  const ids = (search.items || [])
    .map((it) => it.id?.videoId)
    .filter(Boolean);
  if (!ids.length) return [];
  const detailUrl =
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails` +
    `&id=${ids.join(",")}&key=${YT_KEY}`;
  const detail = await ytJson(detailUrl);
  return (detail.items || []).filter(
    (v) => parseDurationSec(v.contentDetails?.duration) <= SHORTS_MAX_SEC
  );
}

async function saveSnapshot(kind, note, items) {
  const { data: snap, error: snapErr } = await sb
    .from("scout_snapshots")
    .insert({ kind, note })
    .select()
    .single();
  if (snapErr) throw new Error(`snapshot ${kind}: ${snapErr.message}`);

  const rows = items.map((v, i) => {
    const row = toRow(v, i);
    row.snapshot_id = snap.id;
    return row;
  });

  let saved = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await sb.from("scout_videos").insert(chunk);
    if (error) throw new Error(`videos ${kind}: ${error.message}`);
    saved += chunk.length;
  }
  console.log(`OK [${kind}] snapshot=${snap.id} rows=${saved}`);
  return { snapshotId: snap.id, saved };
}

async function main() {
  console.log(`=== ${market.title} 수집 시작 (${REGION}) ===`);

  const popular = await fetchMostPopular();
  const longItems = popular.filter(
    (v) => parseDurationSec(v.contentDetails?.duration) > SHORTS_MAX_SEC
  );
  const shortFromPopular = popular.filter(
    (v) => parseDurationSec(v.contentDetails?.duration) <= SHORTS_MAX_SEC
  );
  console.log(
    `mostPopular ${REGION}: ${popular.length} (long ${longItems.length}, short-in-chart ${shortFromPopular.length})`
  );

  await saveSnapshot(KIND_LONG, `daily ${marketId} longform`, longItems);

  let shorts = [];
  try {
    shorts = await fetchShortsPopular();
  } catch (e) {
    console.error("shorts search FAIL:", e.message);
  }
  const byId = new Map();
  for (const v of [...shorts, ...shortFromPopular]) {
    if (!byId.has(v.id)) byId.set(v.id, v);
  }
  const mergedShorts = [...byId.values()].sort(
    (a, b) =>
      parseNum(b.statistics?.viewCount) - parseNum(a.statistics?.viewCount)
  );
  await saveSnapshot(KIND_SHORTS, `daily ${marketId} shorts`, mergedShorts);

  console.log(
    `\n=== 완료: 롱폼 ${longItems.length} · 쇼츠 ${mergedShorts.length} ===`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
