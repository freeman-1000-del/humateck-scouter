# 국가별 유튜브트랜드 복제

## 구조
- `markets/jp.mjs` — 일본 (regionCode, 언어, 니치 Google Trends 시드)
- `fetch.mjs` — `MARKET=jp` (기본) 로 해당 마켓 로드

## 새 국가 추가
1. `markets/jp.mjs` 복사 → `markets/kr.mjs`
2. `regionCode`, `relevanceLanguage`, `title`, `kinds`, `niches[].seed` 수정
3. 수집: `MARKET=kr node fetch.mjs`
4. UI `HUMATECK_CONFIG.MARKET` 를 해당 국가 설정으로 바꾸거나 국가별 HTML 복제

## 니치 카테고리
YouTube mostPopular와 별개로 **Google Trends(DataForSEO)** 시드만으로 수집.
YouTube API 할당량을 쓰지 않음. UI 「니치 (Google)」 탭.

## 롱폼/쇼츠
YouTube API · `regionCode` + (쇼츠) `relevanceLanguage`
