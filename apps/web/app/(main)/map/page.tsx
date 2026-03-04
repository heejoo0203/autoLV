"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useAuth } from "@/app/components/auth-provider";
import { createSearchHistoryLog, fetchSearchHistoryDetail } from "@/app/lib/history-api";
import {
  downloadMapLookupCsv,
  fetchMapLandDetails,
  fetchMapLookup,
  fetchMapLookupByPnu,
  fetchMapPriceRows,
  searchMapLookupByAddress,
} from "@/app/lib/map-api";
import type { LandResultRow, MapLandDetailsResponse, MapLookupResponse } from "@/app/lib/types";

declare global {
  interface Window {
    kakao?: {
      maps: {
        load?: (callback: () => void) => void;
        Map?: new (container: HTMLElement, options: Record<string, unknown>) => any;
        LatLng?: new (lat: number, lng: number) => any;
        Marker?: new (options: Record<string, unknown>) => any;
        event: {
          addListener: (target: any, type: string, handler: (event: any) => void) => void;
        };
      };
    };
  }
}

const CLICK_DEBOUNCE_MS = 300;
const KAKAO_SDK_ID = "autolv-kakao-map-sdk";
const DEFAULT_CENTER_LAT = Number(process.env.NEXT_PUBLIC_MAP_CENTER_LAT ?? "37.5662952");
const DEFAULT_CENTER_LNG = Number(process.env.NEXT_PUBLIC_MAP_CENTER_LNG ?? "126.9779451");

export default function MapPage() {
  return (
    <Suspense fallback={<MapPageFallback />}>
      <MapPageClient />
    </Suspense>
  );
}

function MapPageClient() {
  const { user } = useAuth();
  const params = useSearchParams();
  const recordId = params.get("recordId");

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapFrameRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const inFlightKeyRef = useRef<string>("");
  const lastResolvedKeyRef = useRef<string>("");
  const loadedRecordIdRef = useRef<string>("");

  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [yearlyLoading, setYearlyLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [message, setMessage] = useState("지도를 클릭하면 해당 필지의 공시지가를 조회합니다.");
  const [result, setResult] = useState<MapLookupResponse | null>(null);
  const [landDetails, setLandDetails] = useState<MapLandDetailsResponse | null>(null);

  const isLoggedIn = Boolean(user);

  useEffect(() => {
    const onFullscreenChange = () => {
      const frame = mapFrameRef.current;
      setIsFullscreen(Boolean(frame && document.fullscreenElement === frame));
      window.setTimeout(() => {
        if (typeof mapRef.current?.relayout === "function") {
          mapRef.current.relayout();
        }
      }, 150);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY?.trim();
    if (!appKey) {
      setMessage("NEXT_PUBLIC_KAKAO_MAP_APP_KEY 설정이 필요합니다.");
      return;
    }

    let mounted = true;
    void loadKakaoMapSdk(appKey)
      .then(async () => {
        await waitForKakaoMapsLoadCallback();
        if (!mounted) return;
        const kakaoMaps = window.kakao?.maps;
        if (!kakaoMaps?.Map || !kakaoMaps?.LatLng || typeof kakaoMaps.event?.addListener !== "function") {
          setMessage("카카오 지도 SDK 초기화 실패: 앱 키 또는 도메인 등록을 확인해 주세요.");
          return;
        }
        if (!mapContainerRef.current) return;
        const center = new kakaoMaps.LatLng(DEFAULT_CENTER_LAT, DEFAULT_CENTER_LNG);
        const map = new kakaoMaps.Map(mapContainerRef.current, {
          center,
          level: 3,
        });
        mapRef.current = map;
        setMapReady(true);
        setMessage("지도 로딩이 완료되었습니다. 원하는 위치를 클릭하거나 주소를 입력해 조회해 주세요.");

        kakaoMaps.event.addListener(map, "click", (mouseEvent: any) => {
          const lat = Number(mouseEvent?.latLng?.getLat?.());
          const lng = Number(mouseEvent?.latLng?.getLng?.());
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          scheduleLookup(lat, lng);
        });
      })
      .catch((error) => {
        if (!mounted) return;
        const reason = error instanceof Error ? error.message : "unknown";
        setMessage(`카카오 지도를 불러오지 못했습니다. (${reason})`);
      });

    return () => {
      mounted = false;
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!recordId || !isLoggedIn) return;
    if (loadedRecordIdRef.current === recordId) return;

    let cancelled = false;
    const run = async () => {
      try {
        const record = await fetchSearchHistoryDetail(recordId);
        if (cancelled) return;
        loadedRecordIdRef.current = recordId;
        if (record.search_type !== "map") {
          setMessage("선택한 조회기록은 지도 조회기록이 아닙니다.");
          return;
        }

        const payload = await fetchMapLookupByPnu(record.pnu);
        if (cancelled) return;
        applyLookupResult(payload, { persistHistory: false, customMessage: "조회기록에서 지도 결과를 불러왔습니다." });
      } catch (error) {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : "조회기록을 불러오지 못했습니다.");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [recordId, isLoggedIn]);

  useEffect(() => {
    if (!mapReady || !result) return;
    setMarker(result.lat, result.lng);
    moveMapCenter(result.lat, result.lng);
  }, [mapReady, result]);

  const scheduleLookup = (lat: number, lng: number) => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      void runLookup(lat, lng);
    }, CLICK_DEBOUNCE_MS);
  };

  const runLookup = async (lat: number, lng: number) => {
    const pointKey = toPointKey(lat, lng);
    if (inFlightKeyRef.current === pointKey) return;
    if (lastResolvedKeyRef.current === pointKey && result) {
      setMessage("이미 조회한 위치입니다. 다른 위치를 클릭해 주세요.");
      return;
    }

    inFlightKeyRef.current = pointKey;
    setLoading(true);
    setMessage("지도 위치를 조회 중입니다...");
    setMarker(lat, lng);

    try {
      const payload = await fetchMapLookup(lat, lng);
      applyLookupResult(payload, { persistHistory: true });
    } catch (error) {
      setResult(null);
      setMessage(error instanceof Error ? error.message : "지도 조회 중 오류가 발생했습니다.");
    } finally {
      inFlightKeyRef.current = "";
      setLoading(false);
    }
  };

  const runAddressSearch = async () => {
    if (!mapReady) {
      setMessage("지도가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    const keyword = addressQuery.trim();
    if (keyword.length < 2) {
      setMessage("주소를 2자 이상 입력해 주세요.");
      return;
    }

    setAddressLoading(true);
    setMessage("주소를 좌표로 변환해 조회 중입니다...");
    try {
      const payload = await searchMapLookupByAddress(keyword);
      applyLookupResult(payload, { persistHistory: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "주소 기반 지도 조회에 실패했습니다.");
    } finally {
      setAddressLoading(false);
    }
  };

  const applyLookupResult = (
    payload: MapLookupResponse,
    options: { persistHistory: boolean; customMessage?: string },
  ) => {
    setResult(payload);
    setLandDetails(null);
    setMarker(payload.lat, payload.lng);
    moveMapCenter(payload.lat, payload.lng);
    lastResolvedKeyRef.current = toPointKey(payload.lat, payload.lng);

    if (options.customMessage) {
      setMessage(options.customMessage);
    } else {
      setMessage(payload.cache_hit ? "캐시된 데이터로 조회되었습니다." : "최신 데이터로 조회되었습니다.");
    }

    if (!options.persistHistory) return;
    persistMapHistory(payload, payload.rows ?? []);
  };

  const setMarker = (lat: number, lng: number) => {
    const kakaoMaps = window.kakao?.maps;
    if (!kakaoMaps?.LatLng || !kakaoMaps?.Marker || !mapRef.current) return;
    const position = new kakaoMaps.LatLng(lat, lng);
    if (!markerRef.current) {
      markerRef.current = new kakaoMaps.Marker({
        position,
      });
      markerRef.current.setMap?.(mapRef.current);
    } else {
      markerRef.current.setPosition(position);
    }
  };

  const moveMapCenter = (lat: number, lng: number) => {
    const kakaoMaps = window.kakao?.maps;
    if (!kakaoMaps?.LatLng || !mapRef.current) return;
    const center = new kakaoMaps.LatLng(lat, lng);
    mapRef.current.setCenter?.(center);
  };

  const toggleFullscreen = async () => {
    const frame = mapFrameRef.current;
    if (!frame) return;

    if (!document.fullscreenElement) {
      if (typeof frame.requestFullscreen !== "function") {
        setMessage("브라우저에서 전체화면 기능을 지원하지 않습니다.");
        return;
      }
      await frame.requestFullscreen();
      return;
    }

    if (document.fullscreenElement === frame) {
      await document.exitFullscreen();
    }
  };

  const downloadCsv = async () => {
    if (!result?.pnu) return;
    try {
      await downloadMapLookupCsv(result.pnu);
      setMessage("CSV 다운로드를 시작했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CSV 다운로드에 실패했습니다.");
    }
  };

  const loadYearlyRows = async () => {
    if (!result?.pnu) return;
    setYearlyLoading(true);
    try {
      const payload = await fetchMapPriceRows(result.pnu);
      setResult((prev) => (prev ? { ...prev, rows: payload.rows } : prev));
      persistMapHistory(result, payload.rows);
      setMessage(payload.rows.length > 0 ? "연도별 공시지가 데이터를 불러왔습니다." : "연도별 상세 데이터가 없습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "연도별 공시지가 조회에 실패했습니다.");
    } finally {
      setYearlyLoading(false);
    }
  };

  const persistMapHistory = (payload: MapLookupResponse, rows: LandResultRow[]) => {
    if (!isLoggedIn) return;
    const summary = (payload.jibun_address || payload.address_summary || payload.road_address || "").trim();
    void createSearchHistoryLog({
      search_type: "map",
      pnu: payload.pnu,
      address_summary: summary,
      rows,
    }).catch(() => {
      // 조회기록 저장 실패는 사용자 흐름을 막지 않는다.
    });
  };

  const loadLandDetails = async () => {
    if (!result?.pnu) return;
    setDetailLoading(true);
    try {
      const details = await fetchMapLandDetails(result.pnu);
      setLandDetails(details);
      if (!result.area && details.area !== null) {
        setResult((prev) => (prev ? { ...prev, area: details.area } : prev));
      }
      setMessage("토지특성 상세 정보를 불러왔습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "토지특성 상세 조회에 실패했습니다.");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <section className="map-page">
      <div className="map-stage panel">
        <div className="map-stage-head">
          <div>
            <h2>지도조회</h2>
            <p className="hint">지도를 클릭하거나 좌측 상단 주소 입력으로 좌표를 조회할 수 있습니다.</p>
          </div>
          <button type="button" className="map-ghost-btn" onClick={() => void toggleFullscreen()}>
            {isFullscreen ? "전체화면 종료" : "전체화면"}
          </button>
        </div>

        <div ref={mapFrameRef} className={`map-shell ${isFullscreen ? "fullscreen" : ""}`}>
          <form
            className="map-overlay-search"
            onSubmit={(event) => {
              event.preventDefault();
              void runAddressSearch();
            }}
          >
            <input
              className="map-address-input"
              value={addressQuery}
              onChange={(event) => setAddressQuery(event.target.value)}
              placeholder="주소 입력 (예: 서울특별시 강남구 개포동 12-3)"
            />
            <button type="submit" className="map-overlay-btn" disabled={addressLoading || loading || !mapReady}>
              {addressLoading ? "조회 중..." : "주소 조회"}
            </button>
          </form>
          <div ref={mapContainerRef} className="map-canvas" />
        </div>
      </div>

      <section className="map-result panel">
        <div className="map-result-head">
          <h2>조회 결과</h2>
          <button className="btn-primary" onClick={() => void downloadCsv()} disabled={!result?.pnu}>
            CSV 내보내기
          </button>
        </div>
        <p className="hint">{loading ? "조회 중입니다..." : message}</p>

        {!result ? (
          <div className="map-empty">지도를 클릭해 필지 정보를 조회해 주세요.</div>
        ) : (
          <>
            <div className="map-metrics">
              <MetricCard label="지번" value={result.jibun_address || result.address_summary || "-"} />
              <MetricCard label="도로명 주소" value={result.road_address || "-"} />
              <MetricCard label="현재 공시지가(원/㎡)" value={formatNumber(result.price_current)} />
              <MetricCard label="전년도 공시지가(원/㎡)" value={formatNumber(result.price_previous)} />
              <MetricCard label="증감률(%)" value={formatRate(result.growth_rate)} />
              <MetricCard label="면적(㎡)" value={formatArea(result.area)} />
              <MetricCard label="면적×단가(원)" value={formatNumber(result.estimated_total_price)} />
              <MetricCard
                label={`인근 평균(${result.nearby_radius_m}m, 원/㎡)`}
                value={formatNumber(result.nearby_avg_price)}
              />
            </div>

            <div className="hint">
              좌표: {result.lat.toFixed(6)}, {result.lng.toFixed(6)} / 데이터 소스: {result.cache_hit ? "DB 캐시" : "실시간"}
            </div>

            <div className="map-actions-row">
              <button
                type="button"
                className="map-inline-action"
                onClick={() => void loadLandDetails()}
                disabled={detailLoading}
              >
                {detailLoading ? "조회 중..." : "토지특성 상세 조회"}
              </button>
              {!result.road_address ? (
                <span className="hint">
                  이 필지는 도로명주소가 부여되지 않았거나 VWorld 역지오코딩에서 제공되지 않을 수 있습니다.
                </span>
              ) : null}
            </div>

            {landDetails ? (
              <div className="map-metrics map-detail-grid">
                <MetricCard label="상세 기준연도" value={landDetails.stdr_year || "-"} />
                <MetricCard label="지목" value={landDetails.land_category_name || "-"} />
                <MetricCard label="용도지역명" value={landDetails.purpose_area_name || "-"} />
                <MetricCard label="용도지구명" value={landDetails.purpose_district_name || "-"} />
                <MetricCard label="토지면적(㎡)" value={formatArea(landDetails.area)} />
              </div>
            ) : null}

            <MapRowsTable
              rows={result.rows}
              cacheHit={result.cache_hit}
              loading={yearlyLoading}
              onLoadRows={() => void loadYearlyRows()}
            />
          </>
        )}
      </section>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

function MapRowsTable({
  rows,
  cacheHit,
  loading,
  onLoadRows,
}: {
  rows: LandResultRow[];
  cacheHit: boolean;
  loading: boolean;
  onLoadRows: () => void;
}) {
  if (!rows.length) {
    return (
      <div className="map-empty">
        <p className="map-empty-text">
          {cacheHit ? "캐시 데이터에는 연도별 상세가 저장되지 않았습니다." : "연도별 상세 데이터가 없습니다."}
        </p>
        {cacheHit ? (
          <button type="button" className="map-inline-action" onClick={onLoadRows} disabled={loading}>
            {loading ? "조회 중..." : "연도별 공시지가 조회"}
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <table className="data-table">
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
          <tr key={`${row.토지소재지}-${row.기준년도}-${idx}`}>
            <td>{row.기준년도}</td>
            <td>{row.토지소재지}</td>
            <td>{row.지번}</td>
            <td>{row.개별공시지가}</td>
            <td>{row.기준일자}</td>
            <td>{row.공시일자}</td>
            <td>{row.비고}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function toPointKey(lat: number, lng: number): string {
  return `${lat.toFixed(6)}:${lng.toFixed(6)}`;
}

function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("ko-KR");
}

function formatArea(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

function formatRate(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(2)}%`;
}

async function loadKakaoMapSdk(appKey: string): Promise<void> {
  if (window.kakao?.maps?.Map && window.kakao?.maps?.load) return;
  const existing = document.getElementById(KAKAO_SDK_ID) as HTMLScriptElement | null;
  const encodedKey = encodeURIComponent(appKey);
  const expectedToken = `appkey=${encodedKey}`;
  if (existing) {
    const isKeyMatched = existing.src.includes(expectedToken);
    const hasAutoloadFalse = existing.src.includes("autoload=false");
    if (!isKeyMatched || !hasAutoloadFalse) {
      existing.remove();
    } else {
      await waitScript(existing);
      return;
    }
  }

  const script = document.createElement("script");
  script.id = KAKAO_SDK_ID;
  script.async = true;
  script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodedKey}&autoload=false&libraries=services,drawing`;
  document.head.appendChild(script);
  await waitScript(script);
  await waitForKakaoMapGlobalReady();
}

function waitScript(script: HTMLScriptElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps?.load || script.getAttribute("data-loaded") === "true") {
      resolve();
      return;
    }

    const onLoad = () => {
      script.setAttribute("data-loaded", "true");
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      reject(new Error("script load failed"));
    };

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
  });
}

async function waitForKakaoMapGlobalReady(timeoutMs = 4000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (window.kakao?.maps?.load) {
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  throw new Error("kakao global not ready");
}

function waitForKakaoMapsLoadCallback(timeoutMs = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.kakao?.maps?.load) {
      reject(new Error("kakao.maps.load unavailable"));
      return;
    }

    let done = false;
    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error("kakao.maps.load timeout"));
    }, timeoutMs);

    window.kakao.maps.load(() => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve();
    });
  });
}

function MapPageFallback() {
  return (
    <section className="panel">
      <h2>지도조회</h2>
      <p className="hint">지도를 불러오는 중입니다...</p>
    </section>
  );
}
