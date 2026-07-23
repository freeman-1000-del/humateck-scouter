// 국가별 복제: 이 파일을 복사해 markets/kr.mjs 등으로 만들고 MARKET=kr 로 실행
export const market = {
  id: "jp",
  regionCode: "JP",
  relevanceLanguage: "ja",
  continent: "asia",
  locale: "ko-KR", // 운영자 UI (당분간 한국어)
  title: "일본 유튜브트랜드",
  /** snapshot kind prefix → `${id}_long`, `${id}_shorts` */
  kinds: {
    long: "jp_long",
    shorts: "jp_shorts",
    niches: "jp_niches",
  },
  shortsMaxSec: 60,
  /**
   * 일본 인기 니치 — Google Trends(DataForSEO) 시드.
   * YouTube mostPopular 카테고리와 별도로, 구글 검색 관심도로만 수집 가능.
   */
  niches: [
    { id: "challenge", label: "챌린지/리액션", seed: "チャレンジ リアクション ISSEI" },
    { id: "comedy", label: "코미디/개그", seed: "コント ドッキリ おもしろ" },
    { id: "asmr_food", label: "ASMR(음식)", seed: "ASMR 料理 切る音" },
    { id: "mukbang", label: "먹방/대식", seed: "大食い モッパン チャレンジ" },
    { id: "anime_meme", label: "애니 밈/짤", seed: "アニメ 切り抜き あるある" },
    { id: "horror_game", label: "호러 게임 실황", seed: "ホラーゲーム 実況 切り抜き" },
    { id: "kids", label: "아동/패밀리", seed: "キッズ 家族 子供向け" },
    { id: "beauty", label: "뷰티/변신", seed: "メイク ビフォーアフター 変身" },
    { id: "pets", label: "반려동물", seed: "猫 犬 かわいい ペット" },
    { id: "jpop", label: "J-POP", seed: "J-POP カバー 踊ってみた" },
    { id: "fashion", label: "패션 코디", seed: "今日のコーデ ファッション" },
    { id: "unboxing", label: "리뷰/언박싱", seed: "開封 レビュー 買ってよかった" },
    { id: "anime_review", label: "애니 리뷰/기대작", seed: "アニメ 感想 期待作" },
    { id: "vlog", label: "일상 브이로그", seed: "ミニvlog 日常 ルーティン" },
    { id: "prank", label: "프랭크/몰카", seed: "ドッキリ いたずら Prank" },
    { id: "satisfying", label: "오디 새티스파잉", seed: "掃除 整理 切断 気持ちいい" },
    { id: "live_clip", label: "라이브 하이라이트", seed: "配信切り抜き ライブ配信" },
    { id: "diy", label: "DIY/생활팁", seed: "ライフハック DIY 便利" },
    { id: "sports", label: "스포츠 하이라이트", seed: "野球 ハイライト 格闘技" },
    { id: "cosplay", label: "성우/코스프레", seed: "声優 コスプレ アニメ" },
  ],
};

export default market;
