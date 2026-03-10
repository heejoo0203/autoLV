"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useAuth } from "@/app/components/auth-provider";
import { LoadingIndicator } from "@/app/components/ui/loading-indicator";
import { ROAD_INITIALS } from "@/app/lib/address";
import { apiFetch, extractError, safeJson } from "@/app/lib/api-client";
import { createSearchHistoryLog, fetchSearchHistoryDetail } from "@/app/lib/history-api";
import { fetchMapLandDetails } from "@/app/lib/map-api";
import type { LdMap, LandResultRow, MapLandDetailsResponse, SearchTab } from "@/app/lib/types";

const SAN_OPTIONS = ["일반", "산"] as const;

type LandLookupApiResponse = {
  search_type: "jibun" | "road";
  pnu: string;
  address_summary: string;
  rows: LandResultRow[];
};

type QuickExample = {
  label: string;
  tab: SearchTab;
  sido: string;
  sigungu: string;
  dong?: string;
  sanType?: (typeof SAN_OPTIONS)[number];
  mainNo?: string;
  subNo?: string;
  roadInitial?: string;
  roadName?: string;
  buildingMainNo?: string;
  buildingSubNo?: string;
};

const QUICK_EXAMPLES: QuickExample[] = [
  { label: "서울시청", tab: "지번", sido: "서울특별시", sigungu: "중구", dong: "태평로1가", mainNo: "31", subNo: "" },
  { label: "성수동", tab: "지번", sido: "서울특별시", sigungu: "성동구", dong: "성수동2가", mainNo: "269", subNo: "25" },
  { label: "압구정", tab: "도로명", sido: "서울특별시", sigungu: "강남구", roadInitial: "ㅇ", roadName: "압구정로", buildingMainNo: "165" },
  { label: "마포", tab: "도로명", sido: "서울특별시", sigungu: "마포구", roadInitial: "ㅁ", roadName: "마포대로", buildingMainNo: "89" },
  { label: "판교", tab: "도로명", sido: "경기도", sigungu: "성남시 분당구", roadInitial: "ㅍ", roadName: "판교역로", buildingMainNo: "166" },
] as const;

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageFallback />}>
      <SearchPageClient />
    </Suspense>
  );
}

function SearchPageClient() {
  const { user, openAuth } = useAuth();
  const params = useSearchParams();
  const formRef = useRef<HTMLElement | null>(null);

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

  const [message, setMessage] = useState("빠른 시작 예시를 선택하거나 주소를 입력해 바로 조회해 보세요.");
  const [rows, setRows] = useState<LandResultRow[]>([]);
  const [lookupPnu, setLookupPnu] = useState("");
  const [lookupAddressSummary, setLookupAddressSummary] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [showLandDetails, setShowLandDetails] = useState(false);
  const [landDetails, setLandDetails] = useState<MapLandDetailsResponse | null>(null);

  const isLoggedIn = Boolean(user);

  const sidoList = useMemo(() => Object.keys(ldMap), [ldMap]);
  const sigunguList = useMemo(() => (sido ? Object.keys(ldMap[sido] ?? {}) : []), [ldMap, sido]);
  const dongList = useMemo(() => (sido && sigungu ? Object.keys(ldMap[sido]?.[sigungu] ?? {}) : []), [ldMap, sido, sigungu]);

  const latestRow = rows[0] ?? null;
  const previousRow = rows[1] ?? null;
  const latestPrice = parseDisplayedCurrency(latestRow?.개별공시지가);
  const previousPrice = parseDisplayedCurrency(previousRow?.개별공시지가);
  const priceDeltaRate =
    latestPrice !== null && previousPrice && previousPrice > 0
      ? Number((((latestPrice - previousPrice) / previousPrice) * 100).toFixed(2))
      : null;
  const resultAddress = latestRow
    ? [latestRow.토지소재지, latestRow.지번].filter(Boolean).join(" ")
    : null;
  const mapContinueHref = useMemo(() => {
    const query = new URLSearchParams();
    if (lookupPnu) query.set("pnu", lookupPnu);
    const address = (lookupAddressSummary || resultAddress || "").trim();
    if (address) query.set("address", address);
    const queryString = query.toString();
    return queryString ? `/map?${queryString}` : "/map";
  }, [lookupAddressSummary, lookupPnu, resultAddress]);

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
        setLookupPnu(rec.pnu ?? "");
        setLookupAddressSummary(rec.address_summary ?? "");
        setLandDetails(null);
        setShowLandDetails(false);
        setShowNoResult((rec.rows ?? []).length === 0);
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
  }, [searchTab, sido, sigungu, roadInitial]);

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

  const applyQuickExample = (example: QuickExample) => {
    setSearchTab(example.tab);
    setSido(example.sido);
    setSigungu(example.sigungu);
    setDong(example.dong ?? "");
    setSanType(example.sanType ?? "일반");
    setMainNo(example.mainNo ?? "");
    setSubNo(example.subNo ?? "");
    setRoadInitial((example.roadInitial as "" | (typeof ROAD_INITIALS)[number]) ?? "");
    setRoadName(example.roadName ?? "");
    setBuildingMainNo(example.buildingMainNo ?? "");
    setBuildingSubNo(example.buildingSubNo ?? "");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMessage(`${example.label} 예시를 불러왔습니다. 바로 조회합니다.`);
    void runQuickExample(example);
  };

  const runSearch = async () => {
    if (!sido || !sigungu) {
      setMessage("시/도와 시/군/구를 선택해 주세요.");
      return;
    }

    setSearching(true);
    setShowNoResult(false);
    setMessage("조회 중입니다...");

    try {
      const body = searchTab === "지번" ? buildJibunPayload() : buildRoadPayload();
      if (!body) return;
      await executeLookup(body, createSummaryFallback(searchTab));
    } catch (error) {
      const text = error instanceof Error ? error.message : "조회 중 오류가 발생했습니다.";
      setRows([]);
      setLookupPnu("");
      setLookupAddressSummary("");
      setLandDetails(null);
      setShowLandDetails(false);
      setShowNoResult(false);
      setMessage(text);
    } finally {
      setSearching(false);
    }
  };

  const runQuickExample = async (example: QuickExample) => {
    setSearching(true);
    setShowNoResult(false);
    try {
      const payload =
        example.tab === "지번"
          ? buildQuickJibunPayload(example)
          : {
              search_type: "road" as const,
              sido: example.sido,
              sigungu: example.sigungu,
              road_name: example.roadName ?? "",
              building_main_no: example.buildingMainNo ?? "",
              building_sub_no: example.buildingSubNo ?? "",
            };

      if (!payload) return;
      await executeLookup(payload, createQuickSummary(example));
    } catch (error) {
      const text = error instanceof Error ? error.message : "예시 조회 중 오류가 발생했습니다.";
      setRows([]);
      setLookupPnu("");
      setLookupAddressSummary("");
      setLandDetails(null);
      setShowLandDetails(false);
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

  const executeLookup = async (body: Record<string, unknown>, fallbackSummary: string) => {
    const res = await landFetch("/api/v1/land/single", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await safeJson(res)) as LandLookupApiResponse | { detail?: unknown };
    if (!res.ok) throw new Error(extractError(payload, "개별공시지가 조회에 실패했습니다."));

    const okPayload = payload as LandLookupApiResponse;
    const nextRows = okPayload.rows ?? [];
    const summary = okPayload.address_summary || fallbackSummary;
    setRows(nextRows);
    setLookupPnu(okPayload.pnu ?? "");
    setLookupAddressSummary(summary);
    setLandDetails(null);
    setShowLandDetails(false);
    setShowNoResult(nextRows.length === 0);
    setMessage(`검색 완료: ${summary} (총 ${nextRows.length}건)`);

    if (isLoggedIn) {
      void createSearchHistoryLog({
        search_type: okPayload.search_type,
        pnu: okPayload.pnu,
        address_summary: summary,
        rows: nextRows,
      }).catch(() => {
        // 조회 자체는 성공했으므로 저장 실패는 흐름을 막지 않는다.
      });
    }
  };

  const loadLandDetails = async (): Promise<MapLandDetailsResponse | null> => {
    if (!lookupPnu) return null;
    setDetailLoading(true);
    try {
      const details = await fetchMapLandDetails(lookupPnu);
      setLandDetails(details);
      setMessage("토지특성 상세 정보를 불러왔습니다.");
      return details;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "토지특성 상세 조회에 실패했습니다.");
      return null;
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleLandDetails = async () => {
    if (showLandDetails) {
      setShowLandDetails(false);
      return;
    }
    if (landDetails) {
      setShowLandDetails(true);
      return;
    }
    const details = await loadLandDetails();
    if (details) {
      setShowLandDetails(true);
    }
  };

  const createSummaryFallback = (type: SearchTab) => {
    if (type === "지번") {
      const jibun = `${sanType === "산" ? "산 " : ""}${mainNo}${subNo ? `-${subNo}` : ""}`;
      return `${sido} ${sigungu} ${dong} ${jibun}`;
    }
    const roadAddress = `${roadName} ${buildingMainNo}${buildingSubNo ? `-${buildingSubNo}` : ""}`;
    return `${sido} ${sigungu} ${roadAddress}`;
  };

  const buildQuickJibunPayload = (example: QuickExample) => {
    const selectedDong = example.dong ?? "";
    const ldCode = ldMap[example.sido]?.[example.sigungu]?.[selectedDong];
    if (!ldCode) {
      setMessage(`${example.label} 예시에 필요한 법정동 코드를 아직 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.`);
      return null;
    }
    return {
      search_type: "jibun" as const,
      ld_code: ldCode,
      san_type: example.sanType ?? "일반",
      main_no: example.mainNo ?? "",
      sub_no: example.subNo ?? "",
    };
  };

  const createQuickSummary = (example: QuickExample) => {
    if (example.tab === "지번") {
      const jibun = `${example.sanType === "산" ? "산 " : ""}${example.mainNo ?? ""}${example.subNo ? `-${example.subNo}` : ""}`;
      return `${example.sido} ${example.sigungu} ${example.dong ?? ""} ${jibun}`.trim();
    }
    const roadAddress = `${example.roadName ?? ""} ${example.buildingMainNo ?? ""}${example.buildingSubNo ? `-${example.buildingSubNo}` : ""}`;
    return `${example.sido} ${example.sigungu} ${roadAddress}`.trim();
  };

  return (
    <div className="lab-page search-page">
      <section className="lab-hero search-hero">
        <div className="lab-hero-copy">
          <span className="lab-eyebrow">Single Parcel Lookup</span>
          <h1>주소를 입력하면 필요한 필지 결과를 한눈에 정리해 드립니다.</h1>
          <p>
            복잡한 입력보다 확인할 결과를 먼저 보이게 구성했습니다. 최신 공시지가와 전년 대비, 연도별 이력을 차분하게
            확인해 보세요.
          </p>
          <div className="lab-hero-actions">
            <Link href="/map" className="lab-btn lab-btn-primary">
              지도에서 조회
            </Link>
            <a href="#search-form" className="lab-btn lab-btn-secondary">
              주소로 조회
            </a>
            {isLoggedIn ? (
              <Link href="/files" className="lab-btn lab-btn-tertiary">
                파일로 일괄 분석
              </Link>
            ) : (
              <button type="button" className="lab-btn lab-btn-tertiary" onClick={() => openAuth("login")}>
                파일 분석은 로그인 필요
              </button>
            )}
          </div>
        </div>

        <div className="lab-hero-panel">
          <div className="lab-hero-panel-card">
            <div className="lab-hero-panel-title">빠른 시작 예시</div>
            <div className="lab-chip-row">
              {QUICK_EXAMPLES.map((example) => (
                <button key={example.label} type="button" className="lab-chip" onClick={() => applyQuickExample(example)}>
                  {example.label}
                </button>
              ))}
            </div>
          </div>
          <div className="lab-hero-panel-grid">
            <article className="lab-mini-card">
              <span>입력 방식</span>
              <strong>지번 · 도로명 구조화 입력</strong>
            </article>
            <article className="lab-mini-card">
              <span>결과 형태</span>
              <strong>핵심 지표 + 연도별 상세 표</strong>
            </article>
          </div>
        </div>
      </section>

      <section className="lab-action-grid">
        <article className="lab-action-card">
          <span className="lab-card-kicker">주소로 조회</span>
          <p>법정동 기반 지번과 도로명을 구조화해 단건 필지를 빠르게 찾습니다.</p>
        </article>
        <article className="lab-action-card">
          <span className="lab-card-kicker">지도 분석</span>
          <p>필지 클릭과 구역 분석을 연결해 단건 조회 결과를 공간 검토로 확장합니다.</p>
        </article>
        <article className="lab-action-card">
          <span className="lab-card-kicker">결과 활용</span>
          <p>조회 결과는 지도조회와 구역 분석의 기준 필지로 바로 이어서 사용할 수 있습니다.</p>
        </article>
      </section>

      <div className="search-workbench">
        <section id="search-form" ref={formRef} className="lab-surface search-form-card">
          <div className="lab-section-head">
            <span className="lab-eyebrow">Lookup Form</span>
            <h2>주소 입력</h2>
            <p>조회 방식만 고른 뒤 행정구역과 주소 요소를 순서대로 채워주시면 됩니다.</p>
          </div>

          <div className="search-tab-switch">
            <button className={`lab-toggle ${searchTab === "지번" ? "active" : ""}`} onClick={() => setSearchTab("지번")}>
              지번 조회
            </button>
            <button className={`lab-toggle ${searchTab === "도로명" ? "active" : ""}`} onClick={() => setSearchTab("도로명")}>
              도로명 조회
            </button>
          </div>

          <div className="search-form-grid">
            <FormField label="시/도">
              <select className="lab-input" value={sido} onChange={(e) => onSelectSido(e.target.value)}>
                <option value="">선택</option>
                {sidoList.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="시/군/구">
              <select className="lab-input" value={sigungu} onChange={(e) => onSelectSigungu(e.target.value)}>
                <option value="">선택</option>
                {sigunguList.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </FormField>

            {searchTab === "지번" ? (
              <FormField label="읍/면/동">
                <select className="lab-input" value={dong} onChange={(e) => setDong(e.target.value)}>
                  <option value="">선택</option>
                  {dongList.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : (
              <div className="lab-field search-road-field">
                <label>도로명</label>
                <div className="search-road-grid">
                  <select
                    className="lab-input compact"
                    value={roadInitial}
                    disabled={initialLoading || availableInitials.length === 0}
                    onChange={(e) => {
                      setRoadInitial(e.target.value as "" | (typeof ROAD_INITIALS)[number]);
                      setRoadName("");
                    }}
                  >
                    <option value="">자음</option>
                    {availableInitials.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <select className="lab-input" value={roadName} onChange={(e) => setRoadName(e.target.value)}>
                    <option value="">{roadLoading ? "불러오는 중..." : "도로명 선택"}</option>
                    {roadList.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {searchTab === "지번" ? (
            <div className="search-inline-card">
              <div className="search-inline-label">지번</div>
              <div className="search-inline-inputs">
                <select className="lab-input compact" value={sanType} onChange={(e) => setSanType(e.target.value as (typeof SAN_OPTIONS)[number])}>
                  {SAN_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <input className="lab-input compact" value={mainNo} onChange={(e) => setMainNo(e.target.value)} placeholder="본번" />
                <span className="search-inline-sep">-</span>
                <input className="lab-input compact" value={subNo} onChange={(e) => setSubNo(e.target.value)} placeholder="부번" />
              </div>
            </div>
          ) : (
            <div className="search-inline-card">
              <div className="search-inline-label">건물번호</div>
              <div className="search-inline-inputs road">
                <input className="lab-input compact" value={buildingMainNo} onChange={(e) => setBuildingMainNo(e.target.value)} placeholder="본번" />
                <span className="search-inline-sep">-</span>
                <input className="lab-input compact" value={buildingSubNo} onChange={(e) => setBuildingSubNo(e.target.value)} placeholder="부번" />
              </div>
            </div>
          )}

          <div className="search-form-actions">
            <button className="lab-btn lab-btn-primary" onClick={() => void runSearch()} disabled={searching}>
              {searching ? <LoadingIndicator label="조회 중" kind="dots" /> : "필지 조회"}
            </button>
            <p className={`search-status-text ${searching ? "busy" : ""}`}>
              {searching ? <LoadingIndicator label="데이터를 정리하고 있습니다" kind="dots" /> : message}
            </p>
          </div>
        </section>

        <section className="lab-surface search-result-card">
          <div className="lab-section-head">
            <span className="lab-eyebrow">Analysis Result</span>
            <h2>분석 결과</h2>
            <p>결과를 단순 표가 아니라 판단 흐름에 맞춘 카드와 상세 이력으로 보여줍니다.</p>
          </div>

          {searching ? (
            <div className="search-skeleton-grid">
              <div className="lab-skeleton tall" />
              <div className="lab-skeleton" />
              <div className="lab-skeleton" />
              <div className="lab-skeleton wide" />
            </div>
          ) : rows.length === 0 ? (
            <div className="lab-empty-state">
              <strong>{showNoResult ? "검색 결과가 없습니다." : "아직 조회한 결과가 없습니다."}</strong>
              <p>
                {showNoResult
                  ? "행정구역과 주소 요소를 다시 확인한 뒤 재조회해 주세요."
                  : "빠른 시작 예시를 선택하거나 주소를 입력해 필지를 분석해보세요."}
              </p>
            </div>
          ) : (
            <>
              <div className="search-report-grid">
                <div className="search-report-summary">
                  <article className="lab-report-hero">
                    <span className="lab-report-kicker">핵심 결과</span>
                    <h3>{resultAddress}</h3>
                    <p>{latestRow?.기준년도 ? `${latestRow.기준년도}년 기준 최신 공시지가를 기준으로 정리한 결과입니다.` : "연도별 공시지가 결과입니다."}</p>
                    <div className="lab-chip-row">
                      <span className="lab-chip subtle">기준연도 {latestRow?.기준년도 ?? "-"}</span>
                      <span className="lab-chip subtle">조회건수 {rows.length}건</span>
                    </div>
                  </article>

                  <div className="search-metric-grid">
                    <article className="lab-metric-card">
                      <span>최신 공시지가</span>
                      <strong>{latestRow?.개별공시지가 ?? "-"}</strong>
                    </article>
                    <article className="lab-metric-card">
                      <span>전년 대비</span>
                      <strong>{priceDeltaRate === null ? "-" : `${priceDeltaRate > 0 ? "+" : ""}${priceDeltaRate}%`}</strong>
                    </article>
                    <article className="lab-metric-card">
                      <span>최신 지번</span>
                      <strong>{latestRow?.지번 ?? "-"}</strong>
                    </article>
                    <article className="lab-metric-card">
                      <span>연도 범위</span>
                      <strong>
                        {rows[rows.length - 1]?.기준년도 ?? "-"} - {latestRow?.기준년도 ?? "-"}
                      </strong>
                    </article>
                  </div>
                </div>

                <div className="search-report-side">
                  <article className="lab-info-card">
                    <h3>다음 액션</h3>
                    <div className="lab-action-stack">
                      <button type="button" className="lab-card-link secondary" onClick={() => void toggleLandDetails()} disabled={!lookupPnu || detailLoading}>
                        {detailLoading ? "토지특성 불러오는 중..." : showLandDetails ? "토지특성 닫기" : "토지특성 보기"}
                      </button>
                      {isLoggedIn ? (
                        <>
                          <Link href={mapContinueHref} className="lab-card-link">
                            지도에서 이어서 보기
                          </Link>
                          <Link href="/history" className="lab-card-link secondary">
                            조회기록에서 다시 열기
                          </Link>
                        </>
                      ) : (
                        <>
                          <Link href={mapContinueHref} className="lab-card-link">
                            지도에서 이어서 보기
                          </Link>
                          <button type="button" className="lab-card-link secondary" onClick={() => openAuth("login")}>
                            로그인 후 기록 저장 사용
                          </button>
                        </>
                      )}
                    </div>
                  </article>

                  <article className="lab-info-card">
                    <h3>해석 포인트</h3>
                    <ul className="lab-bullet-list">
                      <li>최신 단가와 전년 대비 변화를 먼저 확인</li>
                      <li>연도별 이력으로 변동 폭을 비교</li>
                      <li>필요 시 지도조회와 구역 분석으로 확장</li>
                    </ul>
                  </article>
                </div>
              </div>

              {showLandDetails && landDetails ? (
                <section className="search-land-details">
                  <article className="lab-info-card">
                    <h3>토지특성</h3>
                    <div className="search-land-details-grid">
                      <article className="lab-metric-card">
                        <span>상세 기준연도</span>
                        <strong>{landDetails.stdr_year || "-"}</strong>
                      </article>
                      <article className="lab-metric-card">
                        <span>토지면적(㎡)</span>
                        <strong>{landDetails.area === null ? "-" : landDetails.area.toLocaleString("ko-KR")}</strong>
                      </article>
                      <article className="lab-metric-card">
                        <span>지목</span>
                        <strong>{landDetails.land_category_name || "-"}</strong>
                      </article>
                      <article className="lab-metric-card">
                        <span>용도지역명</span>
                        <strong>{landDetails.purpose_area_name || "-"}</strong>
                      </article>
                      <article className="lab-metric-card">
                        <span>용도지구명</span>
                        <strong>{landDetails.purpose_district_name || "-"}</strong>
                      </article>
                    </div>
                  </article>
                </section>
              ) : null}

              <div className="search-detail-table">
                <table className="data-table mobile-card-table search-yearly-table">
                  <thead>
                    <tr>
                      <th>가격기준년도</th>
                      <th>개별공시지가</th>
                      <th>기준일자</th>
                      <th>공시일자</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={`${row.토지소재지}-${idx}`}>
                        <td data-label="가격기준년도">{row.기준년도}</td>
                        <td data-label="개별공시지가">{row.개별공시지가}</td>
                        <td data-label="기준일자">{row.기준일자}</td>
                        <td data-label="공시일자">{row.공시일자}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="lab-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

async function landFetch(path: string, init: RequestInit): Promise<Response> {
  return apiFetch(path, init);
}

function parseDisplayedCurrency(value?: string | null): number | null {
  if (!value) return null;
  const onlyNumber = value.replace(/[^0-9.-]/g, "");
  if (!onlyNumber) return null;
  const parsed = Number(onlyNumber);
  return Number.isFinite(parsed) ? parsed : null;
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
    <section className="lab-surface">
      <div className="lab-section-head">
        <span className="lab-eyebrow">Loading</span>
        <h2>개별조회</h2>
      </div>
      <p>페이지를 불러오는 중입니다...</p>
    </section>
  );
}
