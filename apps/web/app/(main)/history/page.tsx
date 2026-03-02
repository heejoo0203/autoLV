"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/app/components/auth-provider";
import { fetchSearchHistoryLogs } from "@/app/lib/history-api";
import type { SearchHistoryLog } from "@/app/lib/types";

export default function HistoryPage() {
  const router = useRouter();
  const { user, openAuth } = useAuth();
  const isLoggedIn = Boolean(user);
  const [records, setRecords] = useState<SearchHistoryLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isLoggedIn) {
      setRecords([]);
      setMessage("");
      return;
    }
    let ignore = false;
    const run = async () => {
      setLoading(true);
      try {
        const payload = await fetchSearchHistoryLogs(1, 100);
        if (ignore) return;
        setRecords(payload.items);
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
  }, [isLoggedIn]);

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
      {loading ? <p className="hint">불러오는 중...</p> : null}
      {!loading && message ? <p className="hint">{message}</p> : null}
      {records.length === 0 ? (
        <p className="hint">아직 저장된 개별조회 기록이 없습니다.</p>
      ) : (
        <table className="data-table history-table">
          <thead>
            <tr>
              <th>순번</th>
              <th>일시</th>
              <th>유형</th>
              <th>주소</th>
              <th>결과건수</th>
            </tr>
          </thead>
          <tbody>
            {records.map((row, idx) => (
              <tr
                key={row.id}
                onClick={() => router.push(`/search?recordId=${row.id}`)}
                style={{ cursor: "pointer" }}
              >
                <td>{idx + 1}</td>
                <td>{formatKST(row.created_at)}</td>
                <td>{toSearchTypeLabel(row.search_type)}</td>
                <td>{row.address_summary}</td>
                <td>{row.result_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="hint">행을 클릭하면 개별조회 페이지로 이동하여 해당 주소 결과를 다시 표시합니다.</p>
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

function toSearchTypeLabel(searchType: "jibun" | "road"): string {
  return searchType === "jibun" ? "지번" : "도로명";
}
