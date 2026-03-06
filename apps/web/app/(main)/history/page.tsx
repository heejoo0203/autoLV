"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/app/components/auth-provider";
import { deleteSearchHistoryLogs, fetchSearchHistoryLogsWithFilter } from "@/app/lib/history-api";
import type { SearchHistoryLog } from "@/app/lib/types";

type SearchTypeFilter = "all" | "jibun" | "road" | "map";
type SortBy = "created_at" | "address_summary" | "search_type" | "result_count";
type SortOrder = "asc" | "desc";
type SortState = {
  sortBy: SortBy | null;
  sortOrder: SortOrder | null;
};
type AppliedFilter = {
  searchType: SearchTypeFilter;
  sido: string;
  sigungu: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
};
type RegionOption = {
  sido: string;
  sigungu: string;
};

export default function HistoryPage() {
  const router = useRouter();
  const { user, openAuth } = useAuth();
  const isLoggedIn = Boolean(user);
  const [records, setRecords] = useState<SearchHistoryLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());

  const [searchTypeFilter, setSearchTypeFilter] = useState<SearchTypeFilter>("all");
  const [sidoFilter, setSidoFilter] = useState("");
  const [sigunguFilter, setSigunguFilter] = useState("");
  const [sortState, setSortState] = useState<SortState>({ sortBy: null, sortOrder: null });
  const [regionOptions, setRegionOptions] = useState<RegionOption[]>([]);
  const [appliedFilter, setAppliedFilter] = useState<AppliedFilter>({
    searchType: "all",
    sido: "",
    sigungu: "",
    sortBy: "created_at",
    sortOrder: "desc",
  });

  const applySortState = (nextSortState: SortState) => {
    setSortState(nextSortState);
    setAppliedFilter((prev) => ({
      ...prev,
      sortBy: nextSortState.sortBy ?? "created_at",
      sortOrder: nextSortState.sortBy && nextSortState.sortOrder ? nextSortState.sortOrder : "desc",
    }));
  };

  const sidoOptions = useMemo(
    () =>
      Array.from(new Set(regionOptions.map((item) => item.sido)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ko")),
    [regionOptions],
  );

  const sigunguOptions = useMemo(() => {
    const filtered = regionOptions.filter((item) => !sidoFilter || item.sido === sidoFilter);
    return Array.from(new Set(filtered.map((item) => item.sigungu)))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "ko"));
  }, [regionOptions, sidoFilter]);

  useEffect(() => {
    if (!sigunguFilter) return;
    if (sigunguOptions.includes(sigunguFilter)) return;
    setSigunguFilter("");
  }, [sigunguFilter, sigunguOptions]);

  useEffect(() => {
    if (!isLoggedIn) {
      setRegionOptions([]);
      return;
    }
    let ignore = false;
    const run = async () => {
      try {
        const payload = await fetchSearchHistoryLogsWithFilter({
          page: 1,
          pageSize: 1000,
          sortBy: "created_at",
          sortOrder: "desc",
        });
        if (ignore) return;
        const parsed = payload.items
          .map((item) => parseRegionOption(item.address_summary))
          .filter((item): item is RegionOption => Boolean(item));
        setRegionOptions(parsed);
      } catch {
        if (ignore) return;
        setRegionOptions([]);
      }
    };
    void run();
    return () => {
      ignore = true;
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      setRecords([]);
      setSelectedLogIds(new Set());
      setMessage("");
      return;
    }
    let ignore = false;
    const run = async () => {
      setLoading(true);
      try {
        const payload = await fetchSearchHistoryLogsWithFilter({
          page: 1,
          pageSize: 100,
          searchType: appliedFilter.searchType,
          sido: appliedFilter.sido,
          sigungu: appliedFilter.sigungu,
          sortBy: appliedFilter.sortBy,
          sortOrder: appliedFilter.sortOrder,
        });
        if (ignore) return;
        setRecords(payload.items);
        setSelectedLogIds((prev) => {
          const visibleIds = new Set(payload.items.map((item) => item.id));
          return new Set(Array.from(prev).filter((id) => visibleIds.has(id)));
        });
        setMessage("");
      } catch (error) {
        if (ignore) return;
        setRecords([]);
        setMessage(error instanceof Error ? error.message : "조회기록을 불러오지 못했습니다.");
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    void run();
    return () => {
      ignore = true;
    };
  }, [isLoggedIn, appliedFilter]);

  const allSelected = records.length > 0 && records.every((item) => selectedLogIds.has(item.id));

  const handleToggleSelect = (logId: string) => {
    setSelectedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedLogIds(new Set());
      return;
    }
    setSelectedLogIds(new Set(records.map((item) => item.id)));
  };

  const reloadRecords = async () => {
    setLoading(true);
    try {
      const payload = await fetchSearchHistoryLogsWithFilter({
        page: 1,
        pageSize: 100,
        searchType: appliedFilter.searchType,
        sido: appliedFilter.sido,
        sigungu: appliedFilter.sigungu,
        sortBy: appliedFilter.sortBy,
        sortOrder: appliedFilter.sortOrder,
      });
      setRecords(payload.items);
      setSelectedLogIds((prev) => {
        const visibleIds = new Set(payload.items.map((item) => item.id));
        return new Set(Array.from(prev).filter((id) => visibleIds.has(id)));
      });
      setMessage("");
    } catch (error) {
      setRecords([]);
      setSelectedLogIds(new Set());
      setMessage(error instanceof Error ? error.message : "조회기록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedLogIds.size === 0) return;
    const confirmed = window.confirm(`선택한 조회기록 ${selectedLogIds.size}건을 삭제하시겠습니까?`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      const payload = await deleteSearchHistoryLogs(Array.from(selectedLogIds));
      setSelectedLogIds(new Set());
      setMessage(`삭제 완료: ${payload.deleted_count}건, 건너뜀: ${payload.skipped_count}건`);
      await reloadRecords();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "조회기록 삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <section className="panel">
        <h2>조회기록</h2>
        <p className="hint">조회기록은 로그인 후 확인할 수 있습니다.</p>
        <button className="btn-primary" onClick={() => openAuth("login")}>
          로그인하고 조회기록 보기
        </button>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>조회기록</h2>

      <div className="history-filter-grid">
        <label className="field-label">
          유형 필터
          <select
            className="modal-input"
            value={searchTypeFilter}
            onChange={(event) => setSearchTypeFilter(event.target.value as SearchTypeFilter)}
          >
            <option value="all">전체</option>
            <option value="jibun">지번</option>
            <option value="road">도로명</option>
            <option value="map">지도</option>
          </select>
        </label>

        <label className="field-label">
          시/도 필터
          <select
            className="modal-input"
            value={sidoFilter}
            onChange={(event) => {
              setSidoFilter(event.target.value);
              setSigunguFilter("");
            }}
          >
            <option value="">전체</option>
            {sidoOptions.map((sido) => (
              <option key={sido} value={sido}>
                {sido}
              </option>
            ))}
          </select>
        </label>

        <label className="field-label">
          시/군/구 필터
          <select
            className="modal-input"
            value={sigunguFilter}
            onChange={(event) => setSigunguFilter(event.target.value)}
          >
            <option value="">전체</option>
            {sigunguOptions.map((sigungu) => (
              <option key={sigungu} value={sigungu}>
                {sigungu}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            setAppliedFilter({
              searchType: searchTypeFilter,
              sido: sidoFilter,
              sigungu: sigunguFilter,
              sortBy: sortState.sortBy ?? "created_at",
              sortOrder: sortState.sortBy && sortState.sortOrder ? sortState.sortOrder : "desc",
            })
          }
        >
          조건 적용
        </button>

        <button
          type="button"
          className="nav-item"
          onClick={() => {
            setSearchTypeFilter("all");
            setSidoFilter("");
            setSigunguFilter("");
            setSortState({ sortBy: null, sortOrder: null });
            setAppliedFilter({
              searchType: "all",
              sido: "",
              sigungu: "",
              sortBy: "created_at",
              sortOrder: "desc",
            });
          }}
        >
          필터 초기화
        </button>
      </div>

      <div className="bulk-table-head">
        <h2>기록 목록</h2>
        <div className="bulk-head-actions">
          <button type="button" className="nav-item" onClick={() => void reloadRecords()} disabled={loading || deleting}>
            새로고침
          </button>
          <button
            type="button"
            className="nav-item danger"
            onClick={() => void handleDeleteSelected()}
            disabled={selectedLogIds.size === 0 || deleting || loading}
          >
            {deleting ? "삭제 중..." : "선택 삭제"}
          </button>
        </div>
      </div>

      {loading ? <p className="hint">불러오는 중...</p> : null}
      {!loading && message ? <p className="hint">{message}</p> : null}
      {records.length === 0 ? (
        <div className="empty-box">조건에 맞는 조회기록이 없습니다.</div>
      ) : (
        <table className="data-table history-table mobile-card-table">
          <thead>
            <tr>
              <th className="checkbox-col">
                <input
                  type="checkbox"
                  aria-label="현재 조회기록 전체 선택"
                  checked={allSelected}
                  onChange={(event) => handleToggleSelectAll(event.target.checked)}
                />
              </th>
              <th className="history-center-col">순번</th>
              <th className="history-center-col">
                <button
                  type="button"
                  className={`history-sort-btn${sortState.sortBy === "created_at" ? " active" : ""}`}
                  onClick={() => applySortState(nextSort(sortState, "created_at"))}
                >
                  일시 <span aria-hidden>{sortMark(sortState, "created_at")}</span>
                </button>
              </th>
              <th className="history-center-col">
                <button
                  type="button"
                  className={`history-sort-btn${sortState.sortBy === "search_type" ? " active" : ""}`}
                  onClick={() => applySortState(nextSort(sortState, "search_type"))}
                >
                  유형 <span aria-hidden>{sortMark(sortState, "search_type")}</span>
                </button>
              </th>
              <th className="history-center-col">
                <button
                  type="button"
                  className={`history-sort-btn${sortState.sortBy === "address_summary" ? " active" : ""}`}
                  onClick={() => applySortState(nextSort(sortState, "address_summary"))}
                >
                  주소 <span aria-hidden>{sortMark(sortState, "address_summary")}</span>
                </button>
              </th>
              <th className="history-center-col">
                <button
                  type="button"
                  className={`history-sort-btn${sortState.sortBy === "result_count" ? " active" : ""}`}
                  onClick={() => applySortState(nextSort(sortState, "result_count"))}
                >
                  결과건수 <span aria-hidden>{sortMark(sortState, "result_count")}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((row, idx) => (
              <tr
                key={row.id}
                onClick={() => {
                  if (deleting) return;
                  if (row.search_type === "map") {
                    router.push(`/map?recordId=${row.id}`);
                    return;
                  }
                  router.push(`/search?recordId=${row.id}`);
                }}
                style={{ cursor: "pointer" }}
              >
                <td className="checkbox-col" data-label="선택" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`${row.address_summary} 선택`}
                    checked={selectedLogIds.has(row.id)}
                    onChange={() => handleToggleSelect(row.id)}
                    disabled={deleting}
                  />
                </td>
                <td data-label="순번" className="history-center-col">{idx + 1}</td>
                <td data-label="일시" className="history-center-col">{formatKST(row.created_at)}</td>
                <td data-label="유형" className="history-center-col">{toSearchTypeLabel(row.search_type)}</td>
                <td data-label="주소" className="history-address-col">{row.address_summary}</td>
                <td data-label="결과건수" className="history-center-col">{row.result_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="hint">행을 클릭하면 해당 유형(개별조회/지도조회) 페이지로 이동해 결과를 다시 표시합니다.</p>
    </section>
  );
}

function formatKST(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, "0");
  const ampm = hour < 12 ? "am" : "pm";
  const hour12 = hour % 12 || 12;
  return `${year}.${month}.${day} ${hour12}:${minute} ${ampm}`;
}

function toSearchTypeLabel(searchType: "jibun" | "road" | "map"): string {
  if (searchType === "jibun") return "지번";
  if (searchType === "road") return "도로명";
  return "지도";
}

function parseRegionOption(addressSummary: string): RegionOption | null {
  const tokens = addressSummary.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  return {
    sido: tokens[0],
    sigungu: tokens[1],
  };
}

function nextSort(current: SortState, clickedSortBy: SortBy): SortState {
  if (current.sortBy !== clickedSortBy) {
    return { sortBy: clickedSortBy, sortOrder: "desc" };
  }

  if (current.sortOrder === "desc") {
    return { sortBy: clickedSortBy, sortOrder: "asc" };
  }

  if (current.sortOrder === "asc") {
    return { sortBy: null, sortOrder: null };
  }

  return { sortBy: clickedSortBy, sortOrder: "desc" };
}

function sortMark(state: SortState, sortBy: SortBy): string {
  if (state.sortBy !== sortBy) return "↕";
  if (state.sortOrder === "desc") return "▼";
  if (state.sortOrder === "asc") return "▲";
  return "↕";
}
