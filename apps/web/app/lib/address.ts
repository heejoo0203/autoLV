const CHOSEONG = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

export const ROAD_INITIALS = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"] as const;

const DEFAULT_ROADS = [
  "강남대로",
  "가로수길",
  "남부순환로",
  "동남로",
  "마포대로",
  "백범로",
  "세종대로",
  "영동대로",
  "종로",
  "청계천로",
  "테헤란로",
  "한강대로",
];

const ROADS_BY_SIGUNGU: Record<string, string[]> = {
  강남구: [
    "강남대로",
    "개포로",
    "논현로",
    "도곡로",
    "도곡로11길",
    "도곡로13길",
    "도곡로14길",
    "도곡로17길",
    "도곡로18길",
    "도곡로19길",
    "도곡로21길",
    "도곡로22길",
    "봉은사로",
    "삼성로",
    "선릉로",
    "압구정로",
    "언주로",
    "영동대로",
    "역삼로",
    "테헤란로",
    "학동로",
  ],
  서초구: ["강남대로", "남부순환로", "동작대로", "반포대로", "서초대로", "양재대로", "잠원로"],
  송파구: ["가락로", "마천로", "백제고분로", "삼전로", "송파대로", "양재대로", "올림픽로"],
  마포구: ["독막로", "마포대로", "망원로", "백범로", "성미산로", "신촌로", "월드컵로"],
};

export function roadsByInitial(sigungu: string, initial: string): string[] {
  if (!initial) return [];
  const base = ROADS_BY_SIGUNGU[sigungu] ?? DEFAULT_ROADS;
  return base.filter((name) => initialConsonant(name) === initial);
}

export function initialConsonant(text: string): string {
  if (!text) return "";
  const first = text.trim().charAt(0);
  const code = first.charCodeAt(0);
  if (first >= "ㄱ" && first <= "ㅎ") return first;
  if (code < 0xac00 || code > 0xd7a3) return first.toUpperCase();
  const idx = Math.floor((code - 0xac00) / 588);
  return CHOSEONG[idx] ?? "";
}
