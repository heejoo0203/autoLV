export type AuthMode = "login" | "register";

export type AuthUser = {
  id?: string;
  user_id?: string;
  email: string;
  full_name?: string | null;
};

export type SearchTab = "지번" | "도로명";

export type LdMap = Record<string, Record<string, Record<string, string>>>;

export type LandResultRow = {
  기준년도: string;
  토지소재지: string;
  지번: string;
  개별공시지가: string;
  기준일자: string;
  공시일자: string;
  비고: string;
};

export type SearchHistoryRecord = {
  id: string;
  ownerKey: string;
  시각: string;
  유형: SearchTab;
  주소요약: string;
  결과: LandResultRow[];
};
