"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export default function Home() {
  const [result, setResult] = useState("아직 확인 전");
  const [loading, setLoading] = useState(false);

  const checkApiHealth = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/health`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as { status?: string };
      setResult(`API 연결 성공: ${data.status ?? "unknown"}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setResult(`API 연결 실패: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 820, margin: "80px auto", padding: "0 20px" }}>
      <section
        style={{
          background: "white",
          borderRadius: 16,
          padding: 28,
          border: "1px solid #e2e8f0",
          boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 12 }}>autoLV Web</h1>
        <p style={{ marginTop: 0, color: "#334155" }}>
          0단계 부트스트랩 완료. 아래 버튼으로 FastAPI `GET /health` 연결을 확인합니다.
        </p>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 20 }}>
          <button
            onClick={checkApiHealth}
            disabled={loading}
            style={{
              border: "none",
              borderRadius: 10,
              padding: "10px 16px",
              cursor: "pointer",
              background: "#2563eb",
              color: "white",
              fontWeight: 700,
            }}
          >
            {loading ? "확인 중..." : "API 헬스체크"}
          </button>
          <code style={{ color: "#0f172a", background: "#f1f5f9", padding: "8px 10px", borderRadius: 8 }}>
            {API_BASE}/health
          </code>
        </div>

        <p style={{ marginTop: 18, marginBottom: 0, fontWeight: 600 }}>{result}</p>
      </section>
    </main>
  );
}
