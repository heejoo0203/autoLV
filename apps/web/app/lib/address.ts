const CHOSEONG = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

export const ROAD_INITIALS = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"] as const;

const ROAD_BASE_BY_INITIAL: Record<string, string[]> = {
  ㄱ: ["강남대로", "가로수길", "고산로", "금호로", "경춘로", "고덕로"],
  ㄴ: ["남부순환로", "남산길", "노해로", "능곡로"],
  ㄷ: ["동남로", "대치로", "대학로", "덕양로", "동부로"],
  ㄹ: ["로데오길", "로얄로", "래미안로"],
  ㅁ: ["문화로", "미사대로", "마포대로", "명동길"],
  ㅂ: ["백범로", "봉은사로", "반포대로", "부평로"],
  ㅅ: ["세종대로", "서초대로", "삼성로", "성산로", "송파대로"],
  ㅇ: ["영동대로", "올림픽로", "역삼로", "안양로", "응암로"],
  ㅈ: ["종로", "중앙로", "잠실로", "장한로", "정릉로"],
  ㅊ: ["청계천로", "충무로", "천호대로", "창경궁로"],
  ㅋ: ["코엑스로", "큰길로"],
  ㅌ: ["테헤란로", "통일로", "태평로"],
  ㅍ: ["평창로", "포은로", "팔달로"],
  ㅎ: ["한강대로", "효령로", "화랑로", "홍익로"],
};

export function roadsByInitial(sigungu: string, initial: string): string[] {
  const base = ROAD_BASE_BY_INITIAL[initial] ?? [];
  return base.map((name) => `${sigungu} ${name}`);
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

