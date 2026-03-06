"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useAuth } from "@/app/components/auth-provider";
import { createSearchHistoryLog, fetchSearchHistoryDetail } from "@/app/lib/history-api";
import {
  analyzeMapZone,
  deleteMapZone,
  downloadMapLookupCsv,
  downloadMapZoneCsv,
  excludeMapZoneParcels,
  fetchMapLandDetails,
  fetchMapLookup,
  fetchMapLookupByPnu,
  fetchMapPriceRows,
  fetchMapZone,
  fetchMapZones,
  renameMapZone,
  searchMapLookupByAddress,
} from "@/app/lib/map-api";
import type {
  LandResultRow,
  MapLandDetailsResponse,
  MapLookupResponse,
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

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapFrameRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const zoneLineRef = useRef<any>(null);
  const zonePolygonRef = useRef<any>(null);
  const zonePointOverlaysRef = useRef<any[]>([]);
  const debounceTimerRef = useRef<number | null>(null);
  const inFlightKeyRef = useRef<string>("");
  const lastResolvedKeyRef = useRef<string>("");
  const loadedRecordIdRef = useRef<string>("");
  const loadedZoneIdRef = useRef<string>("");
  const modeRef = useRef<"basic" | "zone">("basic");

  const [viewMode, setViewMode] = useState<"basic" | "zone">("basic");
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [yearlyLoading, setYearlyLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [zoneLoading, setZoneLoading] = useState(false);
  const [zoneExcludeLoading, setZoneExcludeLoading] = useState(false);
  const [zoneListLoading, setZoneListLoading] = useState(false);
  const [zoneLibraryOpen, setZoneLibraryOpen] = useState(false);
  const [zoneItemBusyId, setZoneItemBusyId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDistrictOverlay, setShowDistrictOverlay] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [zoneName, setZoneName] = useState("내 구역");
  const [zonePoints, setZonePoints] = useState<MapZoneCoordinate[]>([]);
  const [selectedZonePnuSet, setSelectedZonePnuSet] = useState<Set<string>>(new Set());
  const [zoneResult, setZoneResult] = useState<MapZoneResponse | null>(null);
  const [zoneList, setZoneList] = useState<MapZoneListItem[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
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
      clearZoneShapes();
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
    if (!isLoggedIn) return;
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
    };
  }, [isLoggedIn]);

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
        setViewMode("basic");
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
    if (!mapReady) return;
    redrawZoneShapes();
  }, [mapReady, zonePoints]);

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

  const appendZonePoint = (lat: number, lng: number) => {
    setZoneResult(null);
    setActiveZoneId(null);
    setSelectedZonePnuSet(new Set());
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
    clearZoneShapes();
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
      const payload = await analyzeMapZone(name, zonePoints);
      applyZoneResult(payload, {
        customMessage: `구역 분석 완료: 구역 내 필지 ${payload.summary.parcel_count}건`,
        fitToZone: false,
        openLibrary: true,
      });
      await loadZoneList();
    } catch (error) {
      setZoneResult(null);
      setMessage(error instanceof Error ? error.message : "구역 분석에 실패했습니다.");
    } finally {
      setZoneLoading(false);
    }
  };

  const runZoneExclude = async () => {
    if (!zoneResult || selectedZonePnuSet.size === 0) {
      return;
    }
    setZoneExcludeLoading(true);
    try {
      const payload = await excludeMapZoneParcels(zoneResult.summary.zone_id, Array.from(selectedZonePnuSet));
      applyZoneResult(payload, { customMessage: "선택한 필지를 분석 결과에서 제외했습니다.", fitToZone: false });
      await loadZoneList();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "필지 제외 처리에 실패했습니다.");
    } finally {
      setZoneExcludeLoading(false);
    }
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
      await downloadMapZoneCsv(zoneResult.summary.zone_id);
      setMessage("구역 분석 CSV 다운로드를 시작했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "구역 CSV 다운로드에 실패했습니다.");
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
    options?: { customMessage?: string; fitToZone?: boolean; openLibrary?: boolean },
  ) => {
    setViewMode("zone");
    setZoneResult(payload);
    setActiveZoneId(payload.summary.zone_id);
    setZoneName(payload.summary.zone_name);
    setZonePoints(payload.coordinates);
    setSelectedZonePnuSet(new Set());
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

  const openZoneParcelInBasicView = async (pnu: string) => {
    setViewMode("basic");
    setLoading(true);
    try {
      const payload = await fetchMapLookupByPnu(pnu);
      applyLookupResult(payload, {
        persistHistory: false,
        customMessage: "구역 결과에서 기본 조회로 전환했습니다.",
      });
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

  return isLoggedIn ? (
    <section className="map-page">
      <div className="map-stage panel">
        <div className="map-stage-head">
          <div>
            <h2>지도조회</h2>
            <div className="map-mode-tabs">
              <button
                type="button"
                className={`map-mode-tab ${viewMode === "basic" ? "active" : ""}`}
                onClick={() => setViewMode("basic")}
              >
                기본 조회
              </button>
              <button
                type="button"
                className={`map-mode-tab ${viewMode === "zone" ? "active" : ""}`}
                onClick={() => setViewMode("zone")}
              >
                구역 조회
              </button>
            </div>
            <p className="hint">
              {viewMode === "basic"
                ? "지도를 클릭하거나 좌측 상단 주소 입력으로 좌표를 조회할 수 있습니다."
                : "지도를 클릭해 구역을 그리고 분석하면 90% 이상 포함 필지 목록/합계를 계산합니다."}
            </p>
          </div>
          <div className="map-head-actions">
            {viewMode === "zone" ? (
              <button
                type="button"
                className={`map-ghost-btn ${zoneLibraryOpen ? "active" : ""}`}
                onClick={() => setZoneLibraryOpen((prev) => !prev)}
              >
                {zoneLibraryOpen ? "저장 구역 닫기" : "저장 구역 보기"}
              </button>
            ) : null}
            <button type="button" className={`map-ghost-btn ${showDistrictOverlay ? "active" : ""}`} onClick={toggleDistrictOverlay}>
              {showDistrictOverlay ? "지적도 끄기" : "지적도 보기"}
            </button>
            <button type="button" className="map-ghost-btn" onClick={() => void toggleFullscreen()}>
              {isFullscreen ? "전체화면 종료" : "전체화면"}
            </button>
          </div>
        </div>

        <div ref={mapFrameRef} className={`map-shell ${isFullscreen ? "fullscreen" : ""}`}>
          {viewMode === "basic" ? (
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
          ) : (
            <>
              <div className="map-overlay-zone">
                <input
                  className="map-address-input"
                  value={zoneName}
                  onChange={(event) => setZoneName(event.target.value)}
                  placeholder="구역 이름"
                />
                <div className="map-zone-tools">
                  <button type="button" className="map-overlay-btn" onClick={undoZonePoint} disabled={zonePoints.length === 0 || zoneLoading}>
                    되돌리기
                  </button>
                  <button type="button" className="map-overlay-btn" onClick={clearZonePoints} disabled={zoneLoading}>
                    초기화
                  </button>
                  <button
                    type="button"
                    className="map-overlay-btn map-overlay-btn-strong"
                    onClick={() => void runZoneAnalyze()}
                    disabled={zoneLoading || zonePoints.length < 3}
                  >
                    {zoneLoading ? "분석 중..." : `구역 분석 (${zonePoints.length})`}
                  </button>
                </div>
              </div>
              <ZoneLibraryPanel
                open={zoneLibraryOpen}
                loading={zoneListLoading}
                items={zoneList}
                activeZoneId={activeZoneId}
                busyZoneId={zoneItemBusyId}
                onSelect={(item) => void loadZoneById(item.zone_id)}
                onRename={(item) => void renameZoneItem(item)}
                onDelete={(item) => void deleteZoneItem(item)}
              />
            </>
          )}
          <div ref={mapContainerRef} className="map-canvas" />
        </div>
      </div>

      <section className="map-result panel">
        <div className="map-result-head">
          <h2>조회 결과</h2>
          {viewMode === "basic" ? (
            <button className="btn-primary" onClick={() => void downloadCsv()} disabled={!result?.pnu}>
              CSV 내보내기
            </button>
          ) : (
            <div className="map-actions-row">
              <button
                type="button"
                className="map-inline-action danger"
                onClick={() => void runZoneExclude()}
                disabled={!zoneResult || selectedZonePnuSet.size === 0 || zoneExcludeLoading}
              >
                {zoneExcludeLoading ? "처리 중..." : `선택 삭제 (${selectedZonePnuSet.size})`}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void runZoneDownload()}
                disabled={!zoneResult}
              >
                CSV 내보내기
              </button>
            </div>
          )}
        </div>
        <p className="hint">{loading ? "조회 중입니다..." : message}</p>

        {viewMode === "basic" ? (
          !result ? (
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
          )
        ) : (
          <ZoneResultTable
            zoneResult={zoneResult}
            selectedPnuSet={selectedZonePnuSet}
            onSelect={(pnu, checked) => toggleZoneSelection(pnu, checked)}
            onLocate={(lat, lng) => {
              if (lat === null || lng === null) return;
              setMarker(lat, lng);
              moveMapCenter(lat, lng);
            }}
            onOpenBasic={(pnu) => void openZoneParcelInBasicView(pnu)}
          />
        )}
      </section>
    </section>
  ) : (
    <section className="panel">
      <h2>지도조회</h2>
      <p className="hint">비로그인 상태에서는 개별조회만 사용할 수 있습니다.</p>
      <button className="btn-primary" onClick={() => openAuth("login")}>
        로그인하고 지도조회 사용하기
      </button>
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

function ZoneLibraryPanel({
  open,
  loading,
  items,
  activeZoneId,
  busyZoneId,
  onSelect,
  onRename,
  onDelete,
}: {
  open: boolean;
  loading: boolean;
  items: MapZoneListItem[];
  activeZoneId: string | null;
  busyZoneId: string | null;
  onSelect: (item: MapZoneListItem) => void;
  onRename: (item: MapZoneListItem) => void;
  onDelete: (item: MapZoneListItem) => void;
}) {
  return (
    <aside className={`map-zone-library ${open ? "open" : ""}`}>
      <div className="map-zone-library-head">
        <h3>저장된 구역</h3>
        <span>{items.length}건</span>
      </div>
      {loading ? <div className="map-zone-library-empty">목록을 불러오는 중입니다...</div> : null}
      {!loading && items.length === 0 ? <div className="map-zone-library-empty">저장된 구역이 없습니다.</div> : null}
      {!loading && items.length > 0 ? (
        <div className="map-zone-library-list">
          {items.map((item) => {
            const busy = busyZoneId === item.zone_id;
            return (
              <div
                key={item.zone_id}
                className={`map-zone-library-item ${activeZoneId === item.zone_id ? "active" : ""}`}
                onClick={() => {
                  if (!busy) {
                    onSelect(item);
                  }
                }}
              >
                <div className="map-zone-library-title-row">
                  <strong>{item.zone_name}</strong>
                  <span>{item.base_year || "-"}</span>
                </div>
                <div className="map-zone-library-meta">
                  <span>필지 {formatNumber(item.parcel_count)}</span>
                  <span>{formatDateTime(item.updated_at)}</span>
                </div>
                <div className="map-zone-library-meta">
                  <span>총합 {formatNumber(item.assessed_total_price)}원</span>
                </div>
                <div className="map-zone-library-actions" onClick={(event) => event.stopPropagation()}>
                  <button type="button" className="map-zone-mini-btn" disabled={busy} onClick={() => onRename(item)}>
                    이름 수정
                  </button>
                  <button type="button" className="map-zone-mini-btn danger" disabled={busy} onClick={() => onDelete(item)}>
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </aside>
  );
}

function ZoneResultTable({
  zoneResult,
  selectedPnuSet,
  onSelect,
  onLocate,
  onOpenBasic,
}: {
  zoneResult: MapZoneResponse | null;
  selectedPnuSet: Set<string>;
  onSelect: (pnu: string, checked: boolean) => void;
  onLocate: (lat: number | null, lng: number | null) => void;
  onOpenBasic: (pnu: string) => void;
}) {
  if (!zoneResult) {
    return <div className="map-empty">구역 좌표를 선택하고 `구역 분석`을 실행해 주세요.</div>;
  }

  const { summary, parcels } = zoneResult;
  const overlapPercent = Math.round((summary.overlap_threshold || 0.9) * 100);
  return (
    <>
      <div className="map-metrics">
        <MetricCard label="구역명" value={summary.zone_name} />
        <MetricCard label="기준연도(최신)" value={summary.base_year || "-"} />
        <MetricCard label="구역 면적(㎡)" value={formatArea(summary.zone_area_sqm)} />
        <MetricCard label="구역 내 필지 수" value={formatNumber(summary.parcel_count)} />
        <MetricCard label="평균 공시지가(원/㎡)" value={formatNumber(summary.average_unit_price)} />
        <MetricCard label="총 공시지가 합계(원)" value={formatNumber(summary.assessed_total_price)} />
      </div>
      <p className="hint">필지 포함 기준: 구역 내부 {overlapPercent}% 이상 포함된 경우만 집계합니다.</p>
      <table className="data-table map-zone-table">
        <thead>
          <tr>
            <th className="center">선택</th>
            <th>지번 주소</th>
            <th>도로명 주소</th>
            <th className="right">면적(㎡)</th>
            <th className="right">공시지가(원/㎡)</th>
            <th className="right">면적×공시지가</th>
            <th className="center">연도</th>
          </tr>
        </thead>
        <tbody>
          {parcels.map((row) => {
            const selected = selectedPnuSet.has(row.pnu);
            return (
              <tr key={row.pnu} className={!row.included ? "excluded" : ""} onClick={() => onLocate(row.lat, row.lng)}>
                <td className="center" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={!row.included}
                    onChange={(event) => onSelect(row.pnu, event.target.checked)}
                    aria-label={`필지 선택 ${row.pnu}`}
                  />
                </td>
                <td onClick={(event) => event.stopPropagation()}>
                  <button type="button" className="map-address-link" onClick={() => onOpenBasic(row.pnu)}>
                    {row.jibun_address || "-"}
                  </button>
                </td>
                <td>{row.road_address || "-"}</td>
                <td className="right">{formatArea(row.area_sqm)}</td>
                <td className="right">{formatNumber(row.price_current)}</td>
                <td className="right">{formatNumber(row.estimated_total_price)}</td>
                <td className="center">{row.price_year || "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
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

function buildZonePointMarker(index: number, isFirst: boolean): HTMLDivElement {
  const element = document.createElement("div");
  element.className = `map-zone-point-marker ${isFirst ? "first" : ""}`;
  element.innerHTML = `<span>${index}</span>`;
  return element;
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

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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
