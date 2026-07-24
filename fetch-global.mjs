// 휴마텍 컨텐츠 스카우터 - 자동 수집기 (Supabase 저장 버전)
import { createClient } from '@supabase/supabase-js';

const YT_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!YT_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("[중단] 환경변수(YOUTUBE_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_KEY)가 없습니다.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const COUNTRIES = [
  { code: "US", continent: "namerica" }, { code: "CA", continent: "namerica" }, { code: "MX", continent: "namerica" },
  { code: "GB", continent: "europe" },   { code: "DE", continent: "europe" },   { code: "FR", continent: "europe" },
  { code: "ES", continent: "europe" },   { code: "IT", continent: "europe" },   { code: "RU", continent: "europe" },
  { code: "JP", continent: "asia" },     { code: "KR", continent: "asia" },     { code: "IN", continent: "asia" },
  { code: "ID", continent: "asia" },     { code: "VN", continent: "asia" },
  { code: "BR", continent: "samerica" },
  { code: "AU", continent: "oceania" }
];

const CATEGORIES = [
  { id: "10", key: "music" },   { id: "23", key: "comedy" },   { id: "15", key: "animals" },
  { id: "26", key: "howto" },   { id: "22", key: "people" },   { id: "27", key: "education" },
  { id: "24", key: "ent" },     { id: "1",  key: "film" },     { id: "17", key: "sports" },
  { id: "25", key: "news" },    { id: "28", key: "science" },  { id: "20", key: "gaming" },
  { id: "19", key: "travel" },  { id: "2",  key: "autos" }
];

const continentOf = (code) => (COUNTRIES.find(c => c.code === code) || {}).continent || null;
function parseNum(n){ return parseInt(n || "0", 10); }

// 유튜브 공식 categoryId(숫자) → 우리 카테고리 키 매핑
const CATEGORY_ID_TO_KEY = {
  "10":"music", "23":"comedy", "15":"animals", "26":"howto", "22":"people",
  "27":"education", "24":"ent", "1":"film", "17":"sports", "25":"news",
  "28":"science", "20":"gaming", "19":"travel", "2":"autos"
};
const trueCategoryOf = (v) => CATEGORY_ID_TO_KEY[v.snippet?.categoryId] || null;

function toRow(v, i, code, categoryKey, license){
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
    country_code: code,
    continent: code === "GLOBAL" ? null : continentOf(code),
    category_key: categoryKey,
    true_category: trueCategoryOf(v),
    license: license,
    rank: i + 1,
    youtube_url: `https://www.youtube.com/watch?v=${v.id}`
  };
}

async function fetchPopular(code, categoryId){
  let url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics`
    + `&chart=mostPopular&regionCode=${code}&maxResults=50&key=${YT_KEY}`;
  if (categoryId) url += `&videoCategoryId=${categoryId}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`${code}${categoryId ? '/' + categoryId : ''}: ${data.error.message}`);
  return data.items || [];
}

async function main(){
  console.log("=== 휴마텍 스카우터 자동 수집 시작 ===");

  const { data: snap, error: snapErr } = await sb
    .from('scout_snapshots')
    .insert({ kind: 'popular', note: 'daily auto' })
    .select()
    .single();
  if (snapErr) { console.error("snapshot 생성 실패:", snapErr.message); process.exit(1); }
  const snapshotId = snap.id;
  console.log(`수집 회차 ID: ${snapshotId}`);

  let allRows = [];
  let allForGlobal = [];
  let diagDone = false;

  for (const c of COUNTRIES){
    try {
      const items = await fetchPopular(c.code, null);
      if (!diagDone && items[0]) {
        console.log(`[진단] 첫 영상 categoryId = ${items[0].snippet?.categoryId} → 변환 = ${trueCategoryOf(items[0])}`);
        diagDone = true;
      }
      const rows = items.map((v, i) => toRow(v, i, c.code, "all", "youtube"));
      rows.forEach(r => r.snapshot_id = snapshotId);
      allRows = allRows.concat(rows);
      allForGlobal = allForGlobal.concat(rows);
      console.log(`OK [전체] ${c.code}: ${rows.length}`);
    } catch(e){ console.log(`FAIL [전체] ${e.message}`); }
  }

  for (const cat of CATEGORIES){
    for (const c of COUNTRIES){
      try {
        const items = await fetchPopular(c.code, cat.id);
        const rows = items.map((v, i) => toRow(v, i, c.code, cat.key, "youtube"));
        rows.forEach(r => r.snapshot_id = snapshotId);
        allRows = allRows.concat(rows);
        console.log(`OK [${cat.key}] ${c.code}: ${rows.length}`);
      } catch(e){ /* 일부 미지원 조합은 건너뜀 */ }
    }
  }

  const seen = new Set();
  const globalRows = [...allForGlobal]
    .sort((a,b)=> b.view_count - a.view_count)
    .filter(v => { if(seen.has(v.video_id)) return false; seen.add(v.video_id); return true; })
    .slice(0,100)
    .map((v,i)=> ({...v, country_code:"GLOBAL", continent:null, category_key:"all", rank:i+1, snapshot_id:snapshotId}));
  allRows = allRows.concat(globalRows);

  let saved = 0, saveErr = null;
  for (let i = 0; i < allRows.length; i += 500){
    const chunk = allRows.slice(i, i + 500);
    const { error } = await sb.from('scout_videos').insert(chunk);
    if (error){ saveErr = error; break; }
    saved += chunk.length;
  }

  if (saveErr){
    console.error("저장 오류:", saveErr.message);
    process.exit(1);
  }
  console.log(`\n=== 완료: 회차 ${snapshotId}에 총 ${saved}건 저장 (전세계 ${globalRows.length} 포함) ===`);
}

main();
