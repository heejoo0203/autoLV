"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useAuth } from "@/app/components/auth-provider";
import { ROAD_INITIALS } from "@/app/lib/address";
import { createSearchHistoryLog, fetchSearchHistoryDetail } from "@/app/lib/history-api";
import type { LdMap, LandResultRow, SearchTab } from "@/app/lib/types";

const SAN_OPTIONS = ["일반", "산"] as const;
const DEFAULT_API_BASE = "http://127.0.0.1:8000";

type LandLookupApiResponse = {
  search_type: "jibun" | "road";
  pnu: string;
  address_summary: string;
  rows: LandResultRow[];
};

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageFallback />}>
      <SearchPageClient />
    </Suspense>
  );
}

function SearchPageClient() {
  const { user } = useAuth();
  const params = useSearchParams();

  const [ldMap, setLdMap] = useState<LdMap>({});
  const [searchTab, setSearchTab] = useState<SearchTab>("지번");

  const [sido, setSido] = useState("");
  const [sigungu, setSigungu] = useState("");
  const [dong, setDong] = useState("");

  const [roadInitial, setRoadInitial] = useState<"" | (typeof ROAD_INITIALS)[number]>("");
  const [roadName, setRoadName] = useState("");
  const [availableInitials, setAvailableInitials] = useState<string[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const [roadList, setRoadList] = useState<string[]>([]);
  const [roadLoading, setRoadLoading] = useState(false);

  const [sanType, setSanType] = useState<(typeof SAN_OPTIONS)[number]>("일반");
  const [mainNo, setMainNo] = useState("");
  const [subNo, setSubNo] = useState("");
  const [buildingMainNo, setBuildingMainNo] = useState("");
  const [buildingSubNo, setBuildingSubNo] = useState("");
  const [searching, setSearching] = useState(false);
  const [showNoResult, setShowNoResult] = useState(false);

  const [message, setMessage] = useState("주소를 선택한 뒤 검색 버튼을 눌러주세요.");
  const [rows, setRows] = useState<LandResultRow[]>([]);

  const isLoggedIn = Boolean(user);

  const sidoList = useMemo(() => Object.keys(ldMap), [ldMap]);
  const sigunguList = useMemo(() => (sido ? Object.keys(ldMap[sido] ?? {}) : []), [ldMap, sido]);
  const dongList = useMemo(() => (sido && sigungu ? Object.keys(ldMap[sido]?.[sigungu] ?? {}) : []), [ldMap, sido, sigungu]);

  useEffect(() => {
    void loadCodes();
  }, []);

  useEffect(() => {
    const recordId = params.get("recordId");
    if (!recordId || !isLoggedIn) return;

    let ignore = false;
    const loadRecord = async () => {
      try {
        const rec = await fetchSearchHistoryDetail(recordId);
        if (ignore) return;
        setRows(rec.rows ?? []);
        setMessage(`이력에서 선택한 주소 결과입니다: ${toDisplayAddress(rec.address_summary, rec.rows ?? [])}`);
      } catch (error) {
        if (ignore) return;
        const text = error instanceof Error ? error.message : "조회기록을 불러오지 못했습니다.";
        setMessage(text);
      }
    };

    void loadRecord();
    return () => {
      ignore = true;
    };
  }, [params, isLoggedIn]);

  const loadCodes = async () => {
    try {
      const res = await fetch("/ld_codes.json", { cache: "force-cache" });
      if (!res.ok) throw new Error("주소 코드 로드 실패");
      setLdMap((await res.json()) as LdMap);
    } catch {
      setMessage("주소 코드 파일을 불러오지 못했습니다.");
    }
  };

  const onSelectSido = (value: string) => {
    setSido(value);
    setSigungu("");
    setDong("");
    setRoadInitial("");
    setRoadName("");
    setAvailableInitials([]);
    setRoadList([]);
  };

  const onSelectSigungu = (value: string) => {
    setSigungu(value);
    setDong("");
    setRoadInitial("");
    setRoadName("");
    setAvailableInitials([]);
    setRoadList([]);
  };

  useEffect(() => {
    if (searchTab !== "도로명") {
      setAvailableInitials([]);
      setInitialLoading(false);
      return;
    }
    if (!sido || !sigungu) {
      setAvailableInitials([]);
      setInitialLoading(false);
      return;
    }

    const controller = new AbortController();
    const fetchInitials = async () => {
      setInitialLoading(true);
      try {
        const query = new URLSearchParams({ sido, sigungu });
        const res = await landFetch(`/api/v1/land/road-initials?${query.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });
        const payload = (await safeJson(res)) as { initials?: string[]; detail?: unknown };
        if (!res.ok) throw new Error(extractError(payload, "도로명 자음 목록 조회에 실패했습니다."));
        const nextInitials = Array.isArray(payload.initials) ? payload.initials : [];
        setAvailableInitials(nextInitials);
        if (!nextInitials.includes(roadInitial)) {
          setRoadInitial("");
          setRoadName("");
          setRoadList([]);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setAvailableInitials([]);
        setRoadInitial("");
        setRoadName("");
        setRoadList([]);
        setMessage(error instanceof Error ? error.message : "도로명 자음 목록 조회 중 오류가 발생했습니다.");
      } finally {
        if (!controller.signal.aborted) setInitialLoading(false);
      }
    };

    void fetchInitials();
    return () => controller.abort();
  }, [searchTab, sido, sigungu]);

  useEffect(() => {
    if (searchTab !== "도로명") {
      setRoadList([]);
      setRoadLoading(false);
      return;
    }
    if (!sido || !sigungu || !roadInitial) {
      setRoadList([]);
      setRoadLoading(false);
      return;
    }

    const controller = new AbortController();
    const fetchRoadNames = async () => {
      setRoadLoading(true);
      try {
        const query = new URLSearchParams({
          sido,
          sigungu,
          initial: roadInitial,
        });
        const res = await landFetch(`/api/v1/land/road-names?${query.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });
        const payload = (await safeJson(res)) as { roads?: string[]; detail?: unknown };
        if (!res.ok) throw new Error(extractError(payload, "도로명 목록 조회에 실패했습니다."));
        setRoadList(Array.isArray(payload.roads) ? payload.roads : []);
      } catch (error) {
        if (controller.signal.aborted) return;
        setRoadList([]);
        setMessage(error instanceof Error ? error.message : "도로명 목록 조회 중 오류가 발생했습니다.");
      } finally {
        if (!controller.signal.aborted) setRoadLoading(false);
      }
    };

    void fetchRoadNames();
    return () => controller.abort();
  }, [searchTab, sido, sigungu, roadInitial]);

  const runSearch = async () => {
    if (!sido || !sigungu) {
      setMessage("시/도와 시/군/구를 선택해 주세요.");
      return;
    }

    setSearching(true);
    setShowNoResult(false);
    setMessage("조회 중입니다...");
    try {
      const body =
        searchTab === "지번"
          ? buildJibunPayload()
          : buildRoadPayload();
      if (!body) return;

      const res = await landFetch("/api/v1/land/single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await safeJson(res)) as LandLookupApiResponse | { detail?: unknown };
      if (!res.ok) throw new Error(extractError(payload, "개별공시지가 조회에 실패했습니다."));

      const okPayload = payload as LandLookupApiResponse;
      const nextRows = okPayload.rows ?? [];
      setRows(nextRows);
      setShowNoResult(nextRows.length === 0);
      const summary = okPayload.address_summary || createSummaryFallback(searchTab);
      setMessage(`검색 완료: ${summary} (총 ${nextRows.length}건)`);

      if (isLoggedIn) {
        void createSearchHistoryLog({
          search_type: okPayload.search_type,
          pnu: okPayload.pnu,
          address_summary: summary,
          rows: nextRows,
        }).catch(() => {
          // 조회 자체는 성공했으므로 히스토리 저장 실패는 사용자 흐름을 막지 않는다.
        });
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "조회 중 오류가 발생했습니다.";
      setRows([]);
      setShowNoResult(false);
      setMessage(text);
    } finally {
      setSearching(false);
    }
  };

  const buildJibunPayload = () => {
    if (!dong || !mainNo) {
      setMessage("지번 검색에는 읍/면/동과 본번이 필요합니다.");
      return null;
    }
    const ldCode = ldMap[sido]?.[sigungu]?.[dong];
    if (!ldCode) {
      setMessage("선택한 읍/면/동의 법정동 코드를 찾지 못했습니다.");
      return null;
    }
    return {
      search_type: "jibun" as const,
      ld_code: ldCode,
      san_type: sanType,
      main_no: mainNo,
      sub_no: subNo,
    };
  };

  const buildRoadPayload = () => {
    if (!roadName || !buildingMainNo) {
      setMessage("도로명 검색에는 도로명과 건물번호가 필요합니다.");
      return null;
    }
    return {
      search_type: "road" as const,
      sido,
      sigungu,
      road_name: roadName,
      building_main_no: buildingMainNo,
      building_sub_no: buildingSubNo,
    };
  };

  const createSummaryFallback = (type: SearchTab) => {
    if (type === "지번") {
      const jibun = `${sanType === "산" ? "산 " : ""}${mainNo}${subNo ? `-${subNo}` : ""}`;
      return `${sido} ${sigungu} ${dong} ${jibun}`;
    }
    const roadAddress = `${roadName} ${buildingMainNo}${buildingSubNo ? `-${buildingSubNo}` : ""}`;
    return `${sido} ${sigungu} ${roadAddress}`;
  };

  return (
    <>
      {!isLoggedIn ? (
        <section className="hero-lite">
          <h1>정확한 토지 가치 데이터, 더 쉽게</h1>
          <p>비로그인 상태에서도 개별 주소 조회를 바로 사용할 수 있습니다.</p>
        </section>
      ) : null}

      <section className="panel">
        <h2>주소 선택</h2>
        <div className="tab-row">
          <button className={`tab-chip ${searchTab === "지번" ? "on" : ""}`} onClick={() => setSearchTab("지번")}>
            지번 검색
          </button>
          <button className={`tab-chip ${searchTab === "도로명" ? "on" : ""}`} onClick={() => setSearchTab("도로명")}>
            도로명 검색
          </button>
        </div>

        <div className="selector-grid">
          <SelectBox title="시/도 선택" value={sido} items={sidoList} onChange={onSelectSido} />
          <SelectBox title="시/군/구 선택" value={sigungu} items={sigunguList} onChange={onSelectSigungu} />

          {searchTab === "지번" ? (
            <SelectBox title="읍/면/동 선택" value={dong} items={dongList} onChange={setDong} />
          ) : (
            <div>
              <label className="field-label">도로명 선택</label>
              <div className="road-select-combo">
                <select
                  className="scroll-select initials"
                  size={8}
                  value={roadInitial}
                  disabled={initialLoading || availableInitials.length === 0}
                  onChange={(e) => {
                    setRoadInitial(e.target.value as "" | (typeof ROAD_INITIALS)[number]);
                    setRoadName("");
                  }}
                >
                  <option value="">선택</option>
                  {initialLoading ? <option value="" disabled>불러오는 중...</option> : null}
                  {!initialLoading && availableInitials.length === 0 ? (
                    <option value="" disabled>
                      사용 가능한 자음 없음
                    </option>
                  ) : null}
                  {availableInitials.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
                <select className="scroll-select roads" size={8} value={roadName} onChange={(e) => setRoadName(e.target.value)}>
                  {roadLoading ? <option value="">불러오는 중...</option> : null}
                  {roadList.map((road) => (
                    <option key={road} value={road}>
                      {road}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {searchTab === "지번" ? (
          <div className="inline-form inline-form-center jibun-inline-form">
            <span className="inline-label">지번 입력</span>
            <select
              className="mini-select jibun-kind-select"
              value={sanType}
              onChange={(e) => setSanType(e.target.value as (typeof SAN_OPTIONS)[number])}
            >
              {SAN_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input className="mini-input jibun-num-input" value={mainNo} onChange={(e) => setMainNo(e.target.value)} placeholder="본번" />
            <span className="inline-sep">-</span>
            <input className="mini-input jibun-num-input" value={subNo} onChange={(e) => setSubNo(e.target.value)} placeholder="부번" />
          </div>
        ) : (
          <div className="inline-form">
            <span className="inline-label">건물번호</span>
            <input className="mini-input" value={buildingMainNo} onChange={(e) => setBuildingMainNo(e.target.value)} placeholder="본번" />
            <span>-</span>
            <input className="mini-input" value={buildingSubNo} onChange={(e) => setBuildingSubNo(e.target.value)} placeholder="부번" />
          </div>
        )}

        <button className="btn-primary full" onClick={() => void runSearch()} disabled={searching}>
          {searching ? "검색 중..." : "검색"}
        </button>
        <p className="hint">{message}</p>
      </section>

      <section className="panel">
        <h2>검색 결과</h2>
        {rows.length === 0 ? (
          <p className="hint">{showNoResult ? "검색 결과가 없습니다." : "주소를 입력하여 조회해주세요."}</p>
        ) : (
          <table className="data-table mobile-card-table">
            <thead>
              <tr>
                <th>가격기준년도</th>
                <th>토지소재지</th>
                <th>지번</th>
                <th>개별공시지가</th>
                <th>기준일자</th>
                <th>공시일자</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${row.토지소재지}-${idx}`}>
                  <td data-label="가격기준년도">{row.기준년도}</td>
                  <td data-label="토지소재지">{row.토지소재지}</td>
                  <td data-label="지번">{row.지번}</td>
                  <td data-label="개별공시지가">{row.개별공시지가}</td>
                  <td data-label="기준일자">{row.기준일자}</td>
                  <td data-label="공시일자">{row.공시일자}</td>
                  <td data-label="비고">{row.비고}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {!isLoggedIn ? (
        <section className="panel promo-min">
          <h2>파일 조회 (로그인 필요)</h2>
          <p>회원가입 후 최대 10,000행 엑셀 업로드, 비동기 처리, 결과 다운로드를 사용할 수 있습니다.</p>
        </section>
      ) : null}
    </>
  );
}

function SelectBox(props: {
  title: string;
  value: string;
  items: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="field-label">{props.title}</label>
      <select className="scroll-select" size={8} value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        <option value="" disabled hidden>
          선택
        </option>
        {props.items.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "");
}

function resolveApiBases(): string[] {
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const bases: string[] = [];
  const isBrowser = typeof window !== "undefined";
  const hasProxy = Boolean(envBase);
  const hostname = isBrowser ? window.location.hostname.toLowerCase() : "";
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local");

  if (isBrowser && hasProxy) {
    bases.push(normalizeBase(window.location.origin));
  }
  if (envBase) bases.push(normalizeBase(envBase));
  if (isBrowser && isLocalHost) {
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    bases.push(`${protocol}//${window.location.hostname}:8000`);
    bases.push("http://localhost:8000");
    bases.push(DEFAULT_API_BASE);
  }
  return Array.from(new Set(bases.map(normalizeBase)));
}

async function landFetch(path: string, init: RequestInit): Promise<Response> {
  let lastError: unknown = null;
  for (const base of resolveApiBases()) {
    try {
      return await fetch(`${base}${path}`, {
        ...init,
        credentials: "include",
      });
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error("API 연결에 실패했습니다.");
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function extractError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

function toDisplayAddress(summary: string, results: LandResultRow[]): string {
  if (results.length > 0) {
    const first = results[0];
    const location = (first.토지소재지 ?? "").trim();
    const jibun = (first.지번 ?? "").trim();
    if (location && jibun) return `${location} ${jibun}`;
    if (location) return location;
  }
  return summary;
}

function SearchPageFallback() {
  return (
    <section className="panel">
      <h2>개별조회</h2>
      <p className="hint">페이지를 불러오는 중입니다...</p>
    </section>
  );
}
