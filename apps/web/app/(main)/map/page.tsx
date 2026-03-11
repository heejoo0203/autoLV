"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useAuth } from "@/app/components/auth-provider";
import { MapFloatingWorkbench } from "@/app/components/map/map-floating-workbench";
import { MapResultDrawer } from "@/app/components/map/map-result-drawer";
import { MapWorkspaceToolbar } from "@/app/components/map/map-workspace-toolbar";
import { LoadingIndicator } from "@/app/components/ui/loading-indicator";
import { ZoneLibraryPanel } from "@/app/components/map/zone-library-panel";
import { createSearchHistoryLog, fetchSearchHistoryDetail } from "@/app/lib/history-api";
import {
  analyzeMapZone,
  deleteMapZone,
  downloadMapLookupCsv,
  downloadMapZonePreviewCsv,
  downloadMapZoneCsv,
  fetchMapLandDetails,
  fetchMapLookup,
  fetchMapLookupByPnu,
  fetchMapPriceRows,
  fetchMapZone,
  fetchMapZones,
  renameMapZone,
  saveMapZone,
  searchMapLookupByAddress,
  updateMapZoneParcelDecisions,
} from "@/app/lib/map-api";
import { buildZoneComparisonSummary } from "@/app/lib/zone-comparison";
import {
  buildZonePointMarker,
  formatArea,
  formatNumber,
  formatRate,
  buildZoneParcelOverlayStyle,
  parseParcelPolygonPaths,
  rebuildZonePreview,
  toPointKey,
} from "@/app/lib/map-view-utils";
import type {
  LandResultRow,
  MapLandDetailsResponse,
  MapLookupResponse,
  MapZoneComparisonSummary,
  MapZoneCoordinate,
  MapZoneListItem,
  MapZoneResponse,
} from "@/app/lib/types";

declare global {
  interface Window {
    kakao?: {
      maps: {
        load?: (callback: () => void) => void;
        Map?: new (container: HTMLElement, options: Record<string, unknown>) => any;
        LatLng?: new (lat: number, lng: number) => any;
        LatLngBounds?: new () => { extend: (latLng: any) => void };
        Marker?: new (options: Record<string, unknown>) => any;
        Polyline?: new (options: Record<string, unknown>) => any;
        Polygon?: new (options: Record<string, unknown>) => any;
        CustomOverlay?: new (options: Record<string, unknown>) => any;
        MapTypeId?: { USE_DISTRICT?: unknown };
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
const MAX_ZONE_POINTS = 100;
const ZONE_LIST_PAGE_SIZE = 50;
const QUICK_LOOKUP_OPTIONS = [
  { label: "서울시청", query: "서울특별시 중구 세종대로 110", caption: "중구 세종대로 110" },
  { label: "성수동", query: "서울특별시 성동구 성수동1가", caption: "성동구 성수동1가" },
  { label: "압구정", query: "서울특별시 강남구 압구정동", caption: "강남구 압구정동" },
  { label: "마포", query: "서울특별시 마포구 공덕동", caption: "마포구 공덕동" },
  { label: "판교", query: "경기도 성남시 분당구 백현동", caption: "성남 판교권" },
] as const;

export default function MapPage() {
  return (
    <Suspense fallback={<MapPageFallback />}>
      <MapPageClient />
    </Suspense>
  );
}

function MapPageClient() {
  const { user, openAuth } = useAuth();
  const params = useSearchParams();
  const recordId = params.get("recordId");
  const zoneId = params.get("zoneId");
  const pnu = params.get("pnu");
  const forwardedAddress = params.get("address")?.trim() ?? "";

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapFrameRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const zoneLineRef = useRef<any>(null);
  const zonePolygonRef = useRef<any>(null);
  const zonePointOverlaysRef = useRef<any[]>([]);
  const zoneParcelPolygonsRef = useRef<any[]>([]);
  const debounceTimerRef = useRef<number | null>(null);
  const inFlightKeyRef = useRef<string>("");
  const lastResolvedKeyRef = useRef<string>("");
  const loadedRecordIdRef = useRef<string>("");
  const loadedZoneIdRef = useRef<string>("");
  const loadedPnuRef = useRef<string>("");
  const modeRef = useRef<"basic" | "zone">("basic");

  const [viewMode, setViewMode] = useState<"basic" | "zone">("basic");
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [yearlyLoading, setYearlyLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [zoneLoading, setZoneLoading] = useState(false);
  const [zoneSaveLoading, setZoneSaveLoading] = useState(false);
  const [zoneExcludeLoading, setZoneExcludeLoading] = useState(false);
  const [zoneListLoading, setZoneListLoading] = useState(false);
  const [zoneLibraryOpen, setZoneLibraryOpen] = useState(true);
  const [mapPanelCollapsed, setMapPanelCollapsed] = useState(false);
  const [zoneItemBusyId, setZoneItemBusyId] = useState<string | null>(null);
  const [compareZoneId, setCompareZoneId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDistrictOverlay, setShowDistrictOverlay] = useState(false);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [zoneName, setZoneName] = useState("내 구역");
  const [zonePoints, setZonePoints] = useState<MapZoneCoordinate[]>([]);
  const [zoneOverlapThreshold, setZoneOverlapThreshold] = useState(0.9);
  const [selectedZonePnuSet, setSelectedZonePnuSet] = useState<Set<string>>(new Set());
  const [deferredZonePnuSet, setDeferredZonePnuSet] = useState<Set<string>>(new Set());
  const [activeZoneParcelPnu, setActiveZoneParcelPnu] = useState<string | null>(null);
  const [zoneComparison, setZoneComparison] = useState<MapZoneComparisonSummary | null>(null);
  const [zoneComparisonLoading, setZoneComparisonLoading] = useState(false);
  const [zoneResult, setZoneResult] = useState<MapZoneResponse | null>(null);
  const [zoneBaseline, setZoneBaseline] = useState<MapZoneResponse | null>(null);
  const [zoneList, setZoneList] = useState<MapZoneListItem[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [message, setMessage] = useState("지도를 클릭하면 해당 필지의 공시지가를 조회합니다.");
  const [result, setResult] = useState<MapLookupResponse | null>(null);
  const [landDetails, setLandDetails] = useState<MapLandDetailsResponse | null>(null);
  const [showLandDetails, setShowLandDetails] = useState(false);

  const isLoggedIn = Boolean(user);
  const aiApplicableCount = zoneResult
    ? zoneResult.parcels.filter((item) => !item.included && item.ai_recommendation === "included").length
    : 0;
  const aiAppliedCount = zoneResult
    ? zoneResult.parcels.filter((item) => item.ai_applied || item.selection_origin === "ai").length
    : 0;
  const aiPreviewEnabled = aiAppliedCount > 0;
  const zoneResultCounts = useMemo(() => {
    if (!zoneResult) {
      return { ai: 0, anomaly: 0, boundary: 0 };
    }
    return {
      ai: zoneResult.parcels.filter((item) => item.ai_recommendation === "included" || item.ai_applied || item.selection_origin === "ai").length,
      anomaly: zoneResult.parcels.filter((item) => item.anomaly_level && item.anomaly_level !== "none").length,
      boundary: zoneResult.parcels.filter((item) => item.inclusion_mode === "boundary_candidate").length,
    };
  }, [zoneResult]);
  const searchIntentLabel = useMemo(() => getSearchIntentLabel(addressQuery), [addressQuery]);
  const quickSearchOptions = useMemo(() => {
    const keyword = addressQuery.trim();
    if (!keyword) return QUICK_LOOKUP_OPTIONS;
    const lowered = keyword.toLowerCase();
    return QUICK_LOOKUP_OPTIONS.filter(
      (item) =>
        item.label.includes(keyword) ||
        item.query.includes(keyword) ||
        item.caption.toLowerCase().includes(lowered),
    ).slice(0, 5);
  }, [addressQuery]);

  const handleModeChange = (nextMode: "basic" | "zone") => {
    if (nextMode === "zone" && !isLoggedIn) {
      setMessage("구역 조회는 로그인 후 사용할 수 있습니다. 비로그인 상태에서는 기본조회만 가능합니다.");
      openAuth("login");
      return;
    }
    setViewMode(nextMode);
  };

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
      clearZoneShapes();
      clearZoneParcelHighlights();
    };
  }, []);

  useEffect(() => {
    modeRef.current = viewMode;
    if (viewMode === "basic") {
      setMessage("지도를 클릭하거나 좌측 상단 주소 입력으로 좌표를 조회할 수 있습니다.");
    } else {
      setMessage("지도를 클릭해 구역을 그리고 분석하면 구역 내부 90% 이상 포함된 필지를 집계합니다.");
    }
  }, [viewMode]);

  useEffect(() => {
    if (!isLoggedIn) return;
    void loadZoneList();
  }, [isLoggedIn]);

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
          if (modeRef.current === "zone") {
            appendZonePoint(lat, lng);
            return;
          }
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
      clearZoneShapes();
      clearZoneParcelHighlights();
    };
  }, []);

  useEffect(() => {
    if (!pnu && !forwardedAddress) return;
    const loadKey = pnu || `addr:${forwardedAddress}`;
    if (loadedPnuRef.current === loadKey) return;

    let cancelled = false;
    const run = async () => {
      try {
        const payload = pnu ? await fetchMapLookupByPnu(pnu) : await searchMapLookupByAddress(forwardedAddress);
        if (cancelled) return;
        loadedPnuRef.current = loadKey;
        setViewMode("basic");
        applyLookupResult(payload, {
          persistHistory: false,
          customMessage: "개별조회 결과에서 지도 기본조회로 이어졌습니다.",
        });
        await hydrateLookupArtifacts(payload, { eagerRows: true, eagerLandDetails: true, revealLandDetails: true });
      } catch (error) {
        if (cancelled) return;
        if (pnu && forwardedAddress) {
          try {
            const payload = await searchMapLookupByAddress(forwardedAddress);
            if (cancelled) return;
            loadedPnuRef.current = loadKey;
            setViewMode("basic");
            applyLookupResult(payload, {
              persistHistory: false,
              customMessage: "개별조회 주소를 기준으로 지도 기본조회로 이어졌습니다.",
            });
            await hydrateLookupArtifacts(payload, { eagerRows: true, eagerLandDetails: true, revealLandDetails: true });
            return;
          } catch {
            // 주소 fallback도 실패하면 기존 에러 메시지를 노출한다.
          }
        }
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : "개별조회 결과를 지도에서 불러오지 못했습니다.");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [forwardedAddress, pnu]);

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

        try {
          const payload = await fetchMapLookupByPnu(record.pnu);
          if (cancelled) return;
          setViewMode("basic");
          applyLookupResult(payload, { persistHistory: false, customMessage: "조회기록에서 지도 결과를 불러왔습니다." });
        } catch (error) {
          if (!record.address_summary) throw error;
          const payload = await searchMapLookupByAddress(record.address_summary);
          if (cancelled) return;
          setViewMode("basic");
          applyLookupResult(payload, { persistHistory: false, customMessage: "조회기록 주소를 기준으로 지도 결과를 불러왔습니다." });
        }
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
    if (!zoneId || !isLoggedIn) return;
    if (loadedZoneIdRef.current === zoneId) return;

    let cancelled = false;
    const run = async () => {
      try {
        const payload = await fetchMapZone(zoneId);
        if (cancelled) return;
        loadedZoneIdRef.current = zoneId;
        applyZoneResult(payload, {
          customMessage: "저장된 구역 분석 결과를 불러왔습니다.",
          fitToZone: true,
          openLibrary: true,
        });
      } catch (error) {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : "구역 분석 결과를 불러오지 못했습니다.");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [zoneId, isLoggedIn]);

  useEffect(() => {
    if (!mapReady || !result) return;
    setMarker(result.lat, result.lng);
    moveMapCenter(result.lat, result.lng);
  }, [mapReady, result]);

  useEffect(() => {
    if ((viewMode === "basic" && result) || (viewMode === "zone" && zoneResult)) {
      setDetailPanelOpen(true);
    }
  }, [viewMode, result, zoneResult]);

  useEffect(() => {
    if (!mapReady) return;
    if (viewMode !== "zone") {
      clearZoneShapes();
      return;
    }
    redrawZoneShapes();
  }, [mapReady, viewMode, zonePoints]);

  useEffect(() => {
    if (!mapReady) return;
    if (viewMode !== "zone") {
      clearZoneParcelHighlights();
      return;
    }
    redrawZoneParcelHighlights();
  }, [mapReady, viewMode, zoneResult, activeZoneParcelPnu]);

  useEffect(() => {
    if (!mapReady || !activeZoneId || !zoneResult?.coordinates?.length) return;
    fitMapToPoints(zoneResult.coordinates);
  }, [mapReady, activeZoneId, zoneResult]);

  useEffect(() => {
    if (!mapReady) return;
    const kakaoMaps = window.kakao?.maps;
    const map = mapRef.current;
    const districtType = kakaoMaps?.MapTypeId?.USE_DISTRICT;
    if (!map || !districtType) return;
    if (showDistrictOverlay) {
      map.addOverlayMapTypeId?.(districtType);
    } else {
      map.removeOverlayMapTypeId?.(districtType);
    }
  }, [mapReady, showDistrictOverlay]);

  const loadZoneList = async () => {
    setZoneListLoading(true);
    try {
      const payload = await fetchMapZones(1, ZONE_LIST_PAGE_SIZE);
      setZoneList(payload.items);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장된 구역 목록을 불러오지 못했습니다.");
    } finally {
      setZoneListLoading(false);
    }
  };

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
      setMessage("주소, 지번 또는 PNU를 2자 이상 입력해 주세요.");
      return;
    }

    await runKeywordSearch(keyword, { persistHistory: true });
  };

  const runKeywordSearch = async (
    keyword: string,
    options: { persistHistory?: boolean; customMessage?: string } = {},
  ) => {
    const normalized = keyword.trim();
    if (normalized.length < 2) {
      setMessage("주소, 지번 또는 PNU를 2자 이상 입력해 주세요.");
      return;
    }

    setAddressLoading(true);
    setMessage(isPnuQuery(normalized) ? "PNU를 기준으로 필지를 조회 중입니다..." : "주소를 좌표로 변환해 조회 중입니다...");
    try {
      const payload = isPnuQuery(normalized)
        ? await fetchMapLookupByPnu(normalized)
        : await searchMapLookupByAddress(normalized);
      applyLookupResult(payload, { persistHistory: options.persistHistory ?? true, customMessage: options.customMessage });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "주소 기반 지도 조회에 실패했습니다.");
    } finally {
      setAddressLoading(false);
    }
  };

  const runQuickSearch = async (query: string) => {
    setAddressQuery(query);
    await runKeywordSearch(query, { persistHistory: true });
  };

  const appendZonePoint = (lat: number, lng: number) => {
    setZoneResult(null);
    setActiveZoneId(null);
    setSelectedZonePnuSet(new Set());
    setDeferredZonePnuSet(new Set());
    setActiveZoneParcelPnu(null);
    setZoneComparison(null);
    setCompareZoneId(null);
    setZonePoints((prev) => {
      if (prev.length >= MAX_ZONE_POINTS) {
        setMessage(`구역 좌표는 최대 ${MAX_ZONE_POINTS}개까지 추가할 수 있습니다.`);
        return prev;
      }
      const next = [...prev, { lat, lng }];
      setMessage(`구역 좌표 ${next.length}개가 설정되었습니다.`);
      return next;
    });
  };

  const undoZonePoint = () => {
    setZoneResult(null);
    setActiveZoneId(null);
    setSelectedZonePnuSet(new Set());
    setDeferredZonePnuSet(new Set());
    setActiveZoneParcelPnu(null);
    setZoneComparison(null);
    setCompareZoneId(null);
    setZonePoints((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      if (next.length === 0) {
        setMessage("구역 좌표가 모두 제거되었습니다.");
      } else {
        setMessage(`구역 좌표 ${next.length}개가 남았습니다.`);
      }
      return next;
    });
  };

  const clearZonePoints = () => {
    setZonePoints([]);
    setZoneResult(null);
    setActiveZoneId(null);
    setSelectedZonePnuSet(new Set());
    setDeferredZonePnuSet(new Set());
    setActiveZoneParcelPnu(null);
    setZoneComparison(null);
    setCompareZoneId(null);
    clearZoneShapes();
    clearZoneParcelHighlights();
    setMessage("구역 좌표를 초기화했습니다.");
  };

  const runZoneAnalyze = async () => {
    if (zonePoints.length < 3) {
      setMessage("구역 분석을 위해 최소 3개 이상의 좌표를 선택해 주세요.");
      return;
    }
    const name = zoneName.trim();
    if (!name) {
      setMessage("구역 이름을 입력해 주세요.");
      return;
    }

    setZoneLoading(true);
    setMessage("구역 내 필지와 공시지가를 분석 중입니다...");
    try {
      const payload = await analyzeMapZone(name, zonePoints, zoneOverlapThreshold);
      applyZoneResult(payload, {
        customMessage: `구역 분석 완료: 확정 포함 ${payload.summary.parcel_count}건, 경계 후보 ${payload.summary.boundary_parcel_count}건입니다. 저장하려면 '구역 저장'을 눌러 주세요.`,
        fitToZone: false,
        openLibrary: true,
      });
    } catch (error) {
      setZoneResult(null);
      setMessage(error instanceof Error ? error.message : "구역 분석에 실패했습니다.");
    } finally {
      setZoneLoading(false);
    }
  };

  const runZoneSave = async () => {
    if (!zoneResult || zoneResult.summary.is_saved) {
      return;
    }
    const name = zoneName.trim();
    if (!name) {
      setMessage("구역 이름을 입력해 주세요.");
      return;
    }

    setZoneSaveLoading(true);
    setMessage("구역을 저장 중입니다...");
    try {
      const payload = await saveMapZone(
        name,
        zonePoints,
        getZoneExcludedPnuList(zoneResult),
        getZoneIncludedOverridePnuList(zoneResult),
        zoneOverlapThreshold,
      );
      applyZoneResult(payload, {
        customMessage: "구역을 저장했습니다. 저장 구역 목록에서 다시 불러올 수 있습니다.",
        fitToZone: false,
        openLibrary: true,
      });
      await loadZoneList();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "구역 저장에 실패했습니다.");
    } finally {
      setZoneSaveLoading(false);
    }
  };

  const runZoneExclude = async () => {
    if (!zoneResult || selectedZonePnuSet.size === 0) {
      return;
    }
    setZoneExcludeLoading(true);
    try {
      const payload = applyLocalZoneDecision(zoneResult, { excludePnuSet: selectedZonePnuSet });
      applyZoneResult(payload, { customMessage: "미리보기 결과에서 선택한 필지를 제외했습니다.", fitToZone: false, preserveBaseline: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "필지 제외 처리에 실패했습니다.");
    } finally {
      setZoneExcludeLoading(false);
    }
  };

  const runZoneInclude = async (decisionOrigin: "user" | "ai" = "user") => {
    if (!zoneResult || selectedZonePnuSet.size === 0) {
      return;
    }
    setZoneExcludeLoading(true);
    try {
      const payload = applyLocalZoneDecision(zoneResult, { includePnuSet: selectedZonePnuSet, decisionOrigin });
      applyZoneResult(payload, { customMessage: "미리보기 결과에서 선택한 필지를 포함했습니다.", fitToZone: false, preserveBaseline: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "필지 포함 처리에 실패했습니다.");
    } finally {
      setZoneExcludeLoading(false);
    }
  };

  const runZoneApplyAi = async () => {
    if (!zoneResult) return;
    const aiRecommendedPnuList = zoneResult.parcels
      .filter((item) => !item.included && item.ai_recommendation === "included")
      .map((item) => item.pnu);
    if (aiRecommendedPnuList.length === 0) {
      setMessage("현재 결과에서 자동 반영할 AI 추천 필지가 없습니다.");
      return;
    }

    setZoneExcludeLoading(true);
    try {
      const payload = applyLocalZoneDecision(zoneResult, { includePnuSet: new Set(aiRecommendedPnuList), decisionOrigin: "ai" });
      applyZoneResult(payload, { customMessage: `AI 추천 필지 ${aiRecommendedPnuList.length}건을 미리보기 결과에 반영했습니다.`, fitToZone: false, preserveBaseline: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 추천 반영에 실패했습니다.");
    } finally {
      setZoneExcludeLoading(false);
    }
  };

  const runZoneDisableAi = () => {
    if (!zoneResult || !zoneBaseline) return;
    const aiPnuSet = new Set(
      zoneResult.parcels
        .filter((item) => item.ai_applied || item.selection_origin === "ai" || item.inclusion_mode === "ai_included")
        .map((item) => item.pnu),
    );
    if (aiPnuSet.size === 0) {
      setMessage("현재 결과에는 해제할 AI 추천 반영 상태가 없습니다.");
      return;
    }
    const baselineMap = new Map(zoneBaseline.parcels.map((item) => [item.pnu, item]));
    const nextParcels = zoneResult.parcels.map((item) => {
      if (!aiPnuSet.has(item.pnu)) return item;
      return baselineMap.get(item.pnu) ? { ...baselineMap.get(item.pnu)! } : item;
    });
    const payload = rebuildZonePreview(zoneResult, nextParcels);
    applyZoneResult(payload, {
      customMessage: `AI 추천 미리보기 ${aiPnuSet.size}건을 해제했습니다.`,
      fitToZone: false,
      preserveBaseline: true,
    });
  };

  const loadZoneById = async (targetZoneId: string, customMessage?: string) => {
    setZoneItemBusyId(targetZoneId);
    try {
      const payload = await fetchMapZone(targetZoneId);
      applyZoneResult(payload, {
        customMessage: customMessage ?? "저장된 구역 분석 결과를 불러왔습니다.",
        fitToZone: true,
        openLibrary: true,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "구역 분석 결과를 불러오지 못했습니다.");
    } finally {
      setZoneItemBusyId(null);
    }
  };

  const compareZoneItem = async (item: MapZoneListItem) => {
    if (!zoneResult) {
      setMessage("먼저 현재 구역 분석 결과를 준비해 주세요.");
      return;
    }
    setCompareZoneId(item.zone_id);
    setZoneComparisonLoading(true);
    try {
      const payload = await fetchMapZone(item.zone_id);
      setZoneComparison(buildZoneComparisonSummary(zoneResult, payload));
      setMessage(`"${item.zone_name}" 저장본과 현재 결과를 비교했습니다.`);
    } catch (error) {
      setZoneComparison(null);
      setMessage(error instanceof Error ? error.message : "구역 비교에 실패했습니다.");
    } finally {
      setZoneComparisonLoading(false);
    }
  };

  const renameZoneItem = async (item: MapZoneListItem) => {
    const nextName = window.prompt("새 구역 이름을 입력해 주세요.", item.zone_name)?.trim();
    if (!nextName || nextName === item.zone_name) return;

    setZoneItemBusyId(item.zone_id);
    try {
      const payload = await renameMapZone(item.zone_id, nextName);
      if (activeZoneId === item.zone_id) {
        applyZoneResult(payload, {
          customMessage: "구역 이름을 변경했습니다.",
          fitToZone: false,
          openLibrary: true,
        });
      } else {
        setMessage("구역 이름을 변경했습니다.");
      }
      await loadZoneList();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "구역 이름 변경에 실패했습니다.");
    } finally {
      setZoneItemBusyId(null);
    }
  };

  const deleteZoneItem = async (item: MapZoneListItem) => {
    const confirmed = window.confirm(`"${item.zone_name}" 구역을 삭제하시겠습니까?`);
    if (!confirmed) return;

    setZoneItemBusyId(item.zone_id);
    try {
      await deleteMapZone(item.zone_id);
      if (activeZoneId === item.zone_id) {
        setActiveZoneId(null);
        setZoneResult(null);
        setZonePoints([]);
        setSelectedZonePnuSet(new Set());
        clearZoneShapes();
      }
      setMessage("구역을 삭제했습니다.");
      await loadZoneList();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "구역 삭제에 실패했습니다.");
    } finally {
      setZoneItemBusyId(null);
    }
  };

  const runZoneDownload = async () => {
    if (!zoneResult) return;
    try {
      if (!zoneResult.summary.is_saved || !zoneResult.summary.zone_id) {
        downloadMapZonePreviewCsv(zoneResult);
        setMessage("현재 미리보기 결과를 CSV로 내려받았습니다.");
        return;
      }
      await downloadMapZoneCsv(zoneResult.summary.zone_id);
      setMessage("구역 분석 CSV 다운로드를 시작했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "구역 CSV 다운로드에 실패했습니다.");
    }
  };

  const runZonePersistChanges = async () => {
    if (!zoneResult?.summary.zone_id) return;
    setZoneSaveLoading(true);
    try {
      const payload = await updateMapZoneParcelDecisions(
        zoneResult.summary.zone_id,
        getZoneIncludedOverridePnuList(zoneResult),
        getZoneExcludedPnuList(zoneResult),
        zoneResult.parcels.some((item) => item.selection_origin === "ai") ? "ai" : "user",
        "구역 미리보기 변경 저장",
      );
      applyZoneResult(payload, {
        customMessage: "구역 변경 사항을 저장했습니다.",
        fitToZone: false,
        openLibrary: true,
      });
      await loadZoneList();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "구역 변경 저장에 실패했습니다.");
    } finally {
      setZoneSaveLoading(false);
    }
  };

  const toggleZoneSelection = (pnu: string, checked: boolean) => {
    setSelectedZonePnuSet((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(pnu);
      } else {
        next.delete(pnu);
      }
      return next;
    });
  };

  const applyLookupResult = (
    payload: MapLookupResponse,
    options: { persistHistory: boolean; customMessage?: string },
  ) => {
    setResult(payload);
    setLandDetails(null);
    setShowLandDetails(false);
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

  const applyZoneResult = (
    payload: MapZoneResponse,
    options?: { customMessage?: string; fitToZone?: boolean; openLibrary?: boolean; preserveBaseline?: boolean },
  ) => {
    setViewMode("zone");
    setZoneResult(payload);
    setZoneOverlapThreshold(payload.summary.overlap_threshold || 0.9);
    if (!options?.preserveBaseline) {
      setZoneBaseline(payload);
    }
    setActiveZoneId(payload.summary.is_saved ? payload.summary.zone_id : null);
    setZoneName(payload.summary.zone_name);
    setZonePoints(payload.coordinates);
    setSelectedZonePnuSet(new Set());
    setDeferredZonePnuSet(new Set());
    setActiveZoneParcelPnu(payload.parcels.find((item) => item.inclusion_mode === "boundary_candidate")?.pnu ?? payload.parcels[0]?.pnu ?? null);
    setZoneComparison(null);
    setCompareZoneId(null);
    if (options?.openLibrary) {
      setZoneLibraryOpen(true);
    }
    if (options?.customMessage) {
      setMessage(options.customMessage);
    }
    if (options?.fitToZone) {
      window.setTimeout(() => {
        fitMapToPoints(payload.coordinates);
      }, 60);
    }
  };

  const getZoneExcludedPnuList = (payload: MapZoneResponse): string[] => {
    return payload.parcels.filter((item) => !item.included).map((item) => item.pnu);
  };

  const getZoneIncludedOverridePnuList = (payload: MapZoneResponse): string[] => {
    return payload.parcels.filter((item) => item.included && !item.selected_by_rule).map((item) => item.pnu);
  };

  const revertZoneParcelsToBaseline = (
    current: MapZoneResponse,
    baseline: MapZoneResponse,
    targetPnuSet: Set<string>,
  ): MapZoneResponse => {
    const baselineMap = new Map(baseline.parcels.map((item) => [item.pnu, item]));
    const nextParcels = current.parcels.map((item) => {
      if (!targetPnuSet.has(item.pnu)) return item;
      const baselineItem = baselineMap.get(item.pnu);
      return baselineItem ? { ...baselineItem } : item;
    });
    return rebuildZonePreview({ ...current, coordinates: baseline.coordinates }, nextParcels);
  };

  const applyLocalZoneDecision = (
    payload: MapZoneResponse,
    options: { includePnuSet?: Set<string>; excludePnuSet?: Set<string>; decisionOrigin?: "user" | "ai" },
  ): MapZoneResponse => {
    const includePnuSet = options.includePnuSet ?? new Set<string>();
    const excludePnuSet = options.excludePnuSet ?? new Set<string>();
    const decisionOrigin = options.decisionOrigin ?? "user";
    const nextParcels = payload.parcels.map((item) => {
      if (includePnuSet.has(item.pnu)) {
        return {
          ...item,
          included: true,
          ai_applied: decisionOrigin === "ai" && item.ai_recommendation === "included",
          selection_origin: decisionOrigin === "ai" && item.ai_recommendation === "included" ? "ai" : "user",
          inclusion_mode: item.selected_by_rule ? item.inclusion_mode : decisionOrigin === "ai" ? "ai_included" : "user_included",
        };
      }
      if (excludePnuSet.has(item.pnu)) {
        return {
          ...item,
          included: false,
          counted_in_summary: false,
          ai_applied: false,
          selection_origin: "user",
          inclusion_mode: item.selected_by_rule ? "user_excluded" : item.inclusion_mode,
        };
      }
      return item;
    });
    return rebuildZonePreview(payload, nextParcels);
  };

  const focusZoneParcel = (parcel: MapZoneResponse["parcels"][number]) => {
    setActiveZoneParcelPnu(parcel.pnu);
    setDetailPanelOpen(true);
    if (parcel.lat !== null && parcel.lng !== null) {
      setMarker(parcel.lat, parcel.lng);
      moveMapCenter(parcel.lat, parcel.lng);
    }
  };

  const toggleDeferredZoneParcel = (pnu: string) => {
    setDeferredZonePnuSet((prev) => {
      const next = new Set(prev);
      if (next.has(pnu)) next.delete(pnu);
      else next.add(pnu);
      return next;
    });
  };

  const applyDirectZoneDecision = (pnu: string, mode: "include" | "exclude") => {
    if (!zoneResult) return;
    const next =
      mode === "include"
        ? applyLocalZoneDecision(zoneResult, { includePnuSet: new Set([pnu]), decisionOrigin: "user" })
        : applyLocalZoneDecision(zoneResult, { excludePnuSet: new Set([pnu]) });
    setDeferredZonePnuSet((prev) => {
      const nextSet = new Set(prev);
      nextSet.delete(pnu);
      return nextSet;
    });
    applyZoneResult(next, {
      customMessage: mode === "include" ? "검토 큐에서 필지를 포함 확정했습니다." : "검토 큐에서 필지를 제외 확정했습니다.",
      fitToZone: false,
      preserveBaseline: true,
    });
    setActiveZoneParcelPnu(pnu);
  };

  const openZoneParcelInBasicView = async (parcel: MapZoneResponse["parcels"][number]) => {
    setViewMode("basic");
    setLoading(true);
    try {
      const payload =
        parcel.lat !== null && parcel.lng !== null
          ? await fetchMapLookup(parcel.lat, parcel.lng)
          : await fetchMapLookupByPnu(parcel.pnu);
      applyLookupResult(payload, {
        persistHistory: false,
        customMessage: "구역 결과에서 기본 조회로 전환했습니다.",
      });
      await hydrateLookupArtifacts(payload, { eagerRows: true, eagerLandDetails: true, revealLandDetails: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "기본조회 전환에 실패했습니다.");
    } finally {
      setLoading(false);
    }
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

  const fitMapToPoints = (points: MapZoneCoordinate[]) => {
    const kakaoMaps = window.kakao?.maps;
    const map = mapRef.current;
    if (!kakaoMaps?.LatLng || !map || points.length === 0) return;

    if (points.length === 1 || !kakaoMaps.LatLngBounds) {
      moveMapCenter(points[0].lat, points[0].lng);
      return;
    }

    const bounds = new kakaoMaps.LatLngBounds();
    for (const point of points) {
      bounds.extend(new kakaoMaps.LatLng(point.lat, point.lng));
    }
    map.setBounds?.(bounds);
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

  const toggleDistrictOverlay = () => {
    setShowDistrictOverlay((prev) => !prev);
  };

  const resetMapView = () => {
    const kakaoMaps = window.kakao?.maps;
    const map = mapRef.current;
    if (!kakaoMaps?.LatLng || !map) return;
    const center = new kakaoMaps.LatLng(DEFAULT_CENTER_LAT, DEFAULT_CENTER_LNG);
    map.setCenter?.(center);
    map.setLevel?.(3);
    setMessage("기본 시야로 되돌렸습니다.");
  };

  const moveToCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage("브라우저가 현재 위치 조회를 지원하지 않습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setMarker(lat, lng);
        moveMapCenter(lat, lng);
        if (viewMode === "basic") {
          void runLookup(lat, lng);
        } else {
          setMessage("현재 위치로 지도를 이동했습니다. 필요하면 이 지점부터 구역을 그릴 수 있습니다.");
        }
      },
      () => {
        setMessage("현재 위치를 가져오지 못했습니다. 위치 권한을 확인해 주세요.");
      },
      { enableHighAccuracy: true, timeout: 7000 },
    );
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

  const loadLandDetails = async (): Promise<MapLandDetailsResponse | null> => {
    if (!result?.pnu) return null;
    setDetailLoading(true);
    try {
      const details = await fetchMapLandDetails(result.pnu);
      setLandDetails(details);
      if (!result.area && details.area !== null) {
        setResult((prev) => (prev ? { ...prev, area: details.area } : prev));
      }
      setMessage("토지특성 상세 정보를 불러왔습니다.");
      return details;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "토지특성 상세 조회에 실패했습니다.");
      return null;
    } finally {
      setDetailLoading(false);
    }
  };

  const copyResultSummary = async () => {
    if (!result) return;
    const text = [
      result.jibun_address || result.address_summary,
      result.road_address,
      `PNU ${result.pnu}`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setMessage("필지 주소와 PNU를 복사했습니다.");
    } catch {
      setMessage("클립보드 복사에 실패했습니다.");
    }
  };

  const toggleLandDetails = async () => {
    if (showLandDetails) {
      setShowLandDetails(false);
      setMessage("토지특성 상세 정보를 닫았습니다.");
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

  const hydrateLookupArtifacts = async (
    payload: MapLookupResponse,
    options: { eagerRows?: boolean; eagerLandDetails?: boolean; revealLandDetails?: boolean } = {},
  ) => {
    if (options.eagerRows && payload.pnu && (!payload.rows || payload.rows.length === 0)) {
      try {
        const yearly = await fetchMapPriceRows(payload.pnu);
        setResult((prev) => (prev && prev.pnu === payload.pnu ? { ...prev, rows: yearly.rows } : prev));
      } catch {
        // 초기 진입 시 연도별 이력이 없더라도 기본 조회 흐름은 유지한다.
      }
    }

    if (options.eagerLandDetails && payload.pnu) {
      try {
        const details = await fetchMapLandDetails(payload.pnu);
        setLandDetails(details);
        if (options.revealLandDetails) {
          setShowLandDetails(true);
        }
        if (!payload.area && details.area !== null) {
          setResult((prev) => (prev && prev.pnu === payload.pnu ? { ...prev, area: details.area } : prev));
        }
      } catch {
        // 상세 정보 실패는 기본 조회 결과 표시를 막지 않는다.
      }
    }
  };

  const redrawZoneShapes = () => {
    const kakaoMaps = window.kakao?.maps;
    const map = mapRef.current;
    if (!kakaoMaps || !map || !kakaoMaps.LatLng || !kakaoMaps.CustomOverlay) return;
    const LatLng = kakaoMaps.LatLng;
    const CustomOverlay = kakaoMaps.CustomOverlay;

    clearZoneShapes();

    const path = zonePoints.map((point) => new LatLng(point.lat, point.lng));
    zonePointOverlaysRef.current = zonePoints.map((point, index) => {
      const overlay = new CustomOverlay({
        map,
        position: new LatLng(point.lat, point.lng),
        yAnchor: 1.1,
        content: buildZonePointMarker(index + 1, index === 0),
      });
      overlay.setMap?.(map);
      return overlay;
    });

    if (path.length >= 2 && kakaoMaps.Polyline) {
      zoneLineRef.current = new kakaoMaps.Polyline({
        map,
        path,
        strokeWeight: 3,
        strokeColor: "#3d7fda",
        strokeOpacity: 0.9,
        strokeStyle: "solid",
      });
    }

    if (path.length >= 3 && kakaoMaps.Polygon) {
      zonePolygonRef.current = new kakaoMaps.Polygon({
        map,
        path,
        strokeWeight: 3,
        strokeColor: "#2f6cc4",
        strokeOpacity: 1,
        fillColor: "#7ea9ec",
        fillOpacity: 0.28,
      });
    }
  };

  const redrawZoneParcelHighlights = () => {
    const kakaoMaps = window.kakao?.maps;
    const map = mapRef.current;
    if (!kakaoMaps || !map || !kakaoMaps.Polygon || !kakaoMaps.LatLng || !zoneResult) {
      clearZoneParcelHighlights();
      return;
    }

    clearZoneParcelHighlights();

    for (const parcel of zoneResult.parcels) {
      if (!parcel.geometry_geojson) continue;
      const overlayStyle = buildZoneParcelOverlayStyle(parcel);
      const paths = parseParcelPolygonPaths(parcel.geometry_geojson, kakaoMaps);
      for (const path of paths) {
        const polygon = new kakaoMaps.Polygon({
          map,
          path,
          strokeWeight: parcel.pnu === activeZoneParcelPnu ? 4 : 2,
          strokeColor: overlayStyle.strokeColor,
          strokeOpacity: parcel.pnu === activeZoneParcelPnu ? 1 : overlayStyle.strokeOpacity,
          strokeStyle: "solid",
          fillColor: overlayStyle.fillColor,
          fillOpacity: parcel.pnu === activeZoneParcelPnu ? Math.min(overlayStyle.fillOpacity + 0.12, 0.68) : overlayStyle.fillOpacity,
        });
        polygon.setMap?.(map);
        zoneParcelPolygonsRef.current.push(polygon);
      }
    }
  };

  const clearZoneShapes = () => {
    if (zoneLineRef.current) {
      zoneLineRef.current.setMap?.(null);
      zoneLineRef.current = null;
    }
    if (zonePolygonRef.current) {
      zonePolygonRef.current.setMap?.(null);
      zonePolygonRef.current = null;
    }
    for (const overlay of zonePointOverlaysRef.current) {
      overlay?.setMap?.(null);
    }
    zonePointOverlaysRef.current = [];
  };

  const clearZoneParcelHighlights = () => {
    for (const polygon of zoneParcelPolygonsRef.current) {
      polygon?.setMap?.(null);
    }
    zoneParcelPolygonsRef.current = [];
  };

  return (
    <section className="map-workspace-shell">
      <div ref={mapFrameRef} className={`map-workspace-frame ${isFullscreen ? "fullscreen" : ""}`}>
        <div ref={mapContainerRef} className="map-canvas map-workspace-canvas" />

        <div className="map-overlay map-overlay-left">
          <MapFloatingWorkbench
            collapsed={mapPanelCollapsed}
            onToggleCollapse={() => setMapPanelCollapsed((prev) => !prev)}
            viewMode={viewMode}
            onModeChange={handleModeChange}
            isLoggedIn={isLoggedIn}
            addressQuery={addressQuery}
            onAddressQueryChange={setAddressQuery}
            onSearchSubmit={() => void runAddressSearch()}
            addressLoading={addressLoading}
            searchIntentLabel={searchIntentLabel}
            quickSearchOptions={quickSearchOptions}
            onQuickSearch={(query) => void runQuickSearch(query)}
            result={result}
            zoneName={zoneName}
            onZoneNameChange={setZoneName}
            zonePointCount={zonePoints.length}
            overlapThreshold={zoneOverlapThreshold}
            onOverlapThresholdChange={setZoneOverlapThreshold}
            zoneLoading={zoneLoading}
            onZoneAnalyze={() => void runZoneAnalyze()}
            onUndoZonePoint={undoZonePoint}
            onClearZonePoints={clearZonePoints}
            zoneLibraryOpen={zoneLibraryOpen}
            onToggleZoneLibrary={() => setZoneLibraryOpen((prev) => !prev)}
            zoneLibrary={
              isLoggedIn ? (
                <ZoneLibraryPanel
                  open={zoneLibraryOpen}
                  loading={zoneListLoading}
                  items={zoneList}
                  activeZoneId={activeZoneId}
                  busyZoneId={zoneItemBusyId}
                  compareZoneId={compareZoneId}
                  onSelect={(item) => void loadZoneById(item.zone_id)}
                  onCompare={(item) => void compareZoneItem(item)}
                  onRename={(item) => void renameZoneItem(item)}
                  onDelete={(item) => void deleteZoneItem(item)}
                />
              ) : null
            }
          />
        </div>

        <div className="map-overlay map-overlay-right-top">
          <MapWorkspaceToolbar
            showDistrictOverlay={showDistrictOverlay}
            onToggleDistrictOverlay={toggleDistrictOverlay}
            onMoveToCurrentLocation={moveToCurrentLocation}
            onResetView={resetMapView}
            onToggleFullscreen={() => void toggleFullscreen()}
            isFullscreen={isFullscreen}
            viewMode={viewMode}
            zoneLibraryOpen={zoneLibraryOpen}
            onToggleZoneLibrary={() => setZoneLibraryOpen((prev) => !prev)}
            onClearZonePoints={clearZonePoints}
          />
        </div>

        {viewMode === "zone" && zoneResult ? (
          <div className="map-overlay map-overlay-left-bottom">
            <div className="map-legend workspace">
              <span><i className="legend-swatch included" />확정 포함 {formatNumber(zoneResult.summary.parcel_count)}</span>
              <span><i className="legend-swatch ai" />AI 권고 {formatNumber(zoneResultCounts.ai)}</span>
              <span><i className="legend-swatch boundary" />경계 검토 {formatNumber(zoneResultCounts.boundary)}</span>
              <span><i className="legend-swatch anomaly" />값 점검 {formatNumber(zoneResultCounts.anomaly)}</span>
            </div>
          </div>
        ) : null}

        <div className="map-overlay map-overlay-status">
          <div className={`map-status-pill ${loading || addressLoading || zoneLoading ? "busy" : ""}`}>
            <strong>{viewMode === "basic" ? "필지 조회" : "구역 분석"}</strong>
            <span>
              {loading || addressLoading || zoneLoading ? (
                <LoadingIndicator label="데이터를 불러오는 중입니다" kind="spinner" />
              ) : (
                message
              )}
            </span>
          </div>
        </div>

        <MapResultDrawer
          open={detailPanelOpen}
          onToggleOpen={() => setDetailPanelOpen((prev) => !prev)}
          viewMode={viewMode}
          message={message}
          result={result}
          landDetails={landDetails}
          showLandDetails={showLandDetails}
          detailLoading={detailLoading}
          yearlyLoading={yearlyLoading}
          onToggleLandDetails={() => void toggleLandDetails()}
          onDownloadCsv={() => void downloadCsv()}
          onLoadRows={() => void loadYearlyRows()}
          onCopyResult={() => void copyResultSummary()}
          zoneResult={zoneResult}
          aiApplicableCount={aiApplicableCount}
          aiPreviewEnabled={aiPreviewEnabled}
          zoneExcludeLoading={zoneExcludeLoading}
          zoneSaveLoading={zoneSaveLoading}
          zoneComparison={zoneComparison}
          zoneComparisonLoading={zoneComparisonLoading}
          activeZoneParcelPnu={activeZoneParcelPnu}
          deferredZonePnuSet={deferredZonePnuSet}
          onApplyAi={() => void runZoneApplyAi()}
          onDisableAi={runZoneDisableAi}
          onIncludeSelected={() => void runZoneInclude("user")}
          onExcludeSelected={() => void runZoneExclude()}
          onSaveZone={() => void runZoneSave()}
          onPersistZone={() => void runZonePersistChanges()}
          onDownloadZoneCsv={() => void runZoneDownload()}
          onClearComparison={() => {
            setZoneComparison(null);
            setCompareZoneId(null);
          }}
          onFocusZoneParcel={focusZoneParcel}
          onIncludeZoneParcel={(pnu) => applyDirectZoneDecision(pnu, "include")}
          onExcludeZoneParcel={(pnu) => applyDirectZoneDecision(pnu, "exclude")}
          onToggleDeferZoneParcel={toggleDeferredZoneParcel}
          selectedPnuSet={selectedZonePnuSet}
          onSelectZoneParcel={(selectedPnu, checked) => toggleZoneSelection(selectedPnu, checked)}
          onOpenZoneParcelInBasic={(parcel) => void openZoneParcelInBasicView(parcel)}
        />
      </div>
    </section>
  );
}

function isPnuQuery(value: string): boolean {
  return /^\d{19}$/.test(value.trim());
}

function getSearchIntentLabel(value: string): string {
  const keyword = value.trim();
  if (!keyword) return "주소·지번·PNU 자동 인식";
  if (isPnuQuery(keyword)) return "PNU 직접 조회";
  if (/\d/.test(keyword)) return "지번 또는 도로명 주소 조회";
  return "주소 키워드 조회";
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

