// 휴마텍 스카우터 - 재사용 허용(CC) 트렌드 수집기
// 검색(search) API 사용 → 100 units/회. 주 1회만 실행.
// 카테고리별로 CC 영상을 검색해 Supabase에 저장 (license='creativeCommon', kind='cc')
import { createClient } from '@supabase/supabase-js';

const YT_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

if (!YT_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[중단] 환경변수가 없습니다.");
  process.exit(1);
}

// API 절약: CC 수집 중지. 일본 롱폼/쇼츠는 fetch.mjs 사용.
console.log("[중지] CC 수집은 비활성입니다. node fetch.mjs (일본 롱폼·쇼츠)를 사용하세요.");
process.exit(0);

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 카테고리별 검색어 (유튜브 videoCategoryId + 검색 키워드 보조)
const CATEGORIES = [
  { id: "10", key: "music" },   { id: "23", key: "comedy" },   { id: "15", key: "animals" },
  { id: "26", key: "howto" },   { id: "22", key: "people" },   { id: "27", key: "education" },
  { id: "24", key: "ent" },     { id: "1",  key: "film" },     { id: "17", key: "sports" },
  { id: "25", key: "news" },    { id: "28", key: "science" },  { id: "20", key: "gaming" },
  { id: "19", key: "travel" },  { id: "2",  key: "autos" }
];

function parseNum(n){ return parseInt(n || "0", 10); }

// 1단계: 카테고리별 CC 영상 검색 (search.list, videoLicense=creativeCommon)
async function searchCC(categoryId){
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet`
    + `&type=video&videoLicense=creativeCommon&videoCategoryId=${categoryId}`
    + `&order=viewCount&maxResults=50&regionCode=JP&relevanceLanguage=ja&key=${YT_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`search ${categoryId}: ${data.error.message}`);
  return (data.items || []).map(it => it.id?.videoId).filter(Boolean);
}

// 2단계: 영상 ID들의 상세 정보 (videos.list, 1 unit) - 조회수 등
async function videoDetails(ids){
  if (!ids.length) return [];
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics`
    + `&id=${ids.join(',')}&key=${YT_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`videos: ${data.error.message}`);
  return data.items || [];
}

function toRow(v, i, categoryKey, snapshotId){
  return {
    snapshot_id: snapshotId,
    video_id: v.id,
    title: v.snippet?.title || "",
    channel: v.snippet?.channelTitle || "",
    channel_id: v.snippet?.channelId || "",
    published_at: v.snippet?.publishedAt || null,
    thumbnail_url: v.snippet?.thumbnails?.medium?.url || "",
    view_count: parseNum(v.statistics?.viewCount),
    like_count: parseNum(v.statistics?.likeCount),
    comment_count: parseNum(v.statistics?.commentCount),
    country_code: "GLOBAL",
    continent: null,
    category_key: categoryKey,
    true_category: null,
    license: "creativeCommon",
    rank: i + 1,
    youtube_url: `https://www.youtube.com/watch?v=${v.id}`
  };
}

async function main(){
  console.log("=== 재사용 허용(CC) 트렌드 수집 시작 ===");

  // CC 전용 회차 생성 (kind='cc')
  const { data: snap, error: snapErr } = await sb
    .from('scout_snapshots')
    .insert({ kind: 'cc', note: 'weekly cc' })
    .select().single();
  if (snapErr) { console.error("snapshot 실패:", snapErr.message); process.exit(1); }
  const snapshotId = snap.id;
  console.log(`CC 회차 ID: ${snapshotId}`);

  let allRows = [];
  let usedUnits = 0;

  for (const cat of CATEGORIES){
    try {
      const ids = await searchCC(cat.id);   // 100 units
      usedUnits += 100;
      if (!ids.length){ console.log(`[${cat.key}] CC 영상 없음`); continue; }
      const details = await videoDetails(ids); // 1 unit
      usedUnits += 1;
      // 조회수 순 정렬 후 순위 부여
      const sorted = details.sort((a,b)=> parseNum(b.statistics?.viewCount) - parseNum(a.statistics?.viewCount));
      const rows = sorted.map((v, i) => toRow(v, i, cat.key, snapshotId));
      allRows = allRows.concat(rows);
      console.log(`OK [${cat.key}] CC: ${rows.length}`);
    } catch(e){ console.log(`FAIL [${cat.key}] ${e.message}`); }
  }

  // 저장
  let saved = 0, saveErr = null;
  for (let i = 0; i < allRows.length; i += 500){
    const chunk = allRows.slice(i, i + 500);
    const { error } = await sb.from('scout_videos').insert(chunk);
    if (error){ saveErr = error; break; }
    saved += chunk.length;
  }
  if (saveErr){ console.error("저장 오류:", saveErr.message); process.exit(1); }

  console.log(`\n=== 완료: CC 회차 ${snapshotId}에 ${saved}건 저장 (약 ${usedUnits} units 사용) ===`);
}

main();
