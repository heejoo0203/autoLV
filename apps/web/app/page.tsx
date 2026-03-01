"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type AuthMode = "login" | "register";
type AddressMode = "jibun" | "road";

type AuthUser = {
  id?: string;
  user_id?: string;
  email: string;
  full_name?: string | null;
};

type HistoryRow = {
  taskId: string;
  type: "지번" | "도로명" | "엑셀";
  timestamp: string;
  totalRows: string;
  status: "완료" | "진행중" | "실패";
};

const MOCK_HISTORY: HistoryRow[] = [
  { taskId: "4033047", type: "지번", timestamp: "2026-03-02 10:12:31", totalRows: "300", status: "완료" },
  { taskId: "4033046", type: "도로명", timestamp: "2026-03-02 09:56:10", totalRows: "120", status: "진행중" },
  { taskId: "4033045", type: "엑셀", timestamp: "2026-03-01 20:48:41", totalRows: "6,500", status: "실패" },
];

export default function Home() {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authOpen, setAuthOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("로그인 후 엑셀 기능을 사용할 수 있습니다.");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("");
  const [registerAgreements, setRegisterAgreements] = useState(false);

  const [addressMode, setAddressMode] = useState<AddressMode>("jibun");
  const [searchMessage, setSearchMessage] = useState("주소를 입력하고 조회를 눌러주세요.");
  const [uploadMessage, setUploadMessage] = useState("로그인하면 엑셀 업로드 기능이 활성화됩니다.");
  const [healthMessage, setHealthMessage] = useState("API 상태 미확인");

  const [jibunProvince, setJibunProvince] = useState("");
  const [jibunCity, setJibunCity] = useState("");
  const [jibunDong, setJibunDong] = useState("");
  const [jibunMainNo, setJibunMainNo] = useState("");
  const [jibunSubNo, setJibunSubNo] = useState("");

  const [roadProvince, setRoadProvince] = useState("");
  const [roadCity, setRoadCity] = useState("");
  const [roadName, setRoadName] = useState("");
  const [roadBuildingNo, setRoadBuildingNo] = useState("");

  const isLoggedIn = Boolean(currentUser);

  useEffect(() => {
    void fetchMe();
    void checkApiHealth();
  }, []);

  const userLabel = useMemo(() => {
    if (!currentUser) return "Guest";
    return currentUser.full_name?.trim() || currentUser.email;
  }, [currentUser]);

  const checkApiHealth = async () => {
    try {
      const response = await fetch(`${API_BASE}/health`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { status?: string };
      setHealthMessage(`API ${data.status ?? "ok"}`);
    } catch {
      setHealthMessage("API 연결 실패");
    }
  };

  const fetchMe = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) {
        setCurrentUser(null);
        return;
      }
      const data = (await response.json()) as AuthUser;
      setCurrentUser(data);
      setUploadMessage("엑셀 업로드 및 비동기 처리 기능을 사용할 수 있습니다.");
    } catch {
      setCurrentUser(null);
    }
  };

  const submitLogin = async () => {
    if (!loginEmail || !loginPassword) {
      setAuthMessage("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    setAuthLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });
      const payload = (await response.json()) as AuthUser | Record<string, unknown>;
      if (!response.ok) throw new Error(extractErrorMessage(payload, "로그인에 실패했습니다."));

      setCurrentUser(payload as AuthUser);
      setAuthMessage("로그인되었습니다.");
      setUploadMessage("엑셀 업로드 및 비동기 처리 기능을 사용할 수 있습니다.");
      setAuthOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "로그인 실패";
      setAuthMessage(message);
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const submitRegister = async () => {
    if (!registerName || !registerEmail || !registerPassword || !registerPasswordConfirm) {
      setAuthMessage("닉네임, 이메일, 비밀번호, 비밀번호 확인을 모두 입력해 주세요.");
      return;
    }
    if (!/^[A-Za-z0-9가-힣]{2,20}$/.test(registerName)) {
      setAuthMessage("닉네임은 2~20자의 한글/영문/숫자만 사용할 수 있습니다.");
      return;
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,16}$/.test(registerPassword)) {
      setAuthMessage("비밀번호는 8~16자, 영문/숫자/특수문자를 모두 포함해야 합니다.");
      return;
    }
    if (registerPassword !== registerPasswordConfirm) {
      setAuthMessage("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    if (!registerAgreements) {
      setAuthMessage("필수 약관 동의가 필요합니다.");
      return;
    }

    setAuthLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: registerEmail,
          password: registerPassword,
          confirm_password: registerPasswordConfirm,
          full_name: registerName,
          agreements: registerAgreements,
        }),
      });
      const payload = (await response.json()) as AuthUser | Record<string, unknown>;
      if (!response.ok) throw new Error(extractErrorMessage(payload, "회원가입에 실패했습니다."));

      setAuthMessage("회원가입 성공. 로그인 후 엑셀 기능을 사용할 수 있습니다.");
      setAuthMode("login");
      setLoginEmail(registerEmail);
      setRegisterName("");
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterPasswordConfirm("");
      setRegisterAgreements(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "회원가입 실패";
      setAuthMessage(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    setAuthLoading(true);
    try {
      await fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      setCurrentUser(null);
      setAuthMessage("로그아웃되었습니다.");
      setUploadMessage("로그인하면 엑셀 업로드 기능이 활성화됩니다.");
    } finally {
      setAuthLoading(false);
    }
  };

  const runAddressSearch = () => {
    if (addressMode === "jibun") {
      if (!jibunProvince || !jibunCity || !jibunDong || !jibunMainNo) {
        setSearchMessage("지번 조회에 필요한 필수 항목을 입력해 주세요.");
        return;
      }
    } else if (!roadProvince || !roadCity || !roadName || !roadBuildingNo) {
      setSearchMessage("도로명 조회에 필요한 필수 항목을 입력해 주세요.");
      return;
    }
    setSearchMessage("공시지가 조회 API 연동 단계에서 실제 조회가 진행됩니다.");
  };

  const triggerExcelAction = () => {
    if (!isLoggedIn) {
      setUploadMessage("엑셀 업로드는 로그인 후 사용할 수 있습니다.");
      setAuthOpen(true);
      setAuthMode("login");
      return;
    }
    setUploadMessage("엑셀 비동기 처리 API 연동 단계에서 실제 업로드를 연결합니다.");
  };

  return (
    <div style={pageWrap}>
      <header style={topBar}>
        <div style={logoWrap}>
          <span style={{ fontWeight: 800, fontSize: 38, letterSpacing: "-1px" }}>auto</span>
          <span style={{ fontWeight: 800, fontSize: 38, color: "#6b90d9", letterSpacing: "-1px" }}>LV</span>
        </div>
        <nav style={navWrap}>
          <button style={navButton}>Search</button>
          <button style={{ ...navButton, ...navButtonActive }}>Dashboard</button>
          <button style={navButton}>History</button>
          <button style={navButton}>Admin</button>
        </nav>
        <div style={authArea}>
          {isLoggedIn ? (
            <>
              <div style={avatar}>{userLabel.charAt(0).toUpperCase()}</div>
              <div style={{ display: "grid", gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{userLabel}</span>
                <button style={linkButton} onClick={logout} disabled={authLoading}>
                  로그아웃
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={authActionButton}
                onClick={() => {
                  setAuthMode("login");
                  setAuthOpen(true);
                }}
              >
                로그인
              </button>
              <button
                style={{ ...authActionButton, background: "#1d4ed8", color: "white" }}
                onClick={() => {
                  setAuthMode("register");
                  setAuthOpen(true);
                }}
              >
                회원가입
              </button>
            </div>
          )}
        </div>
      </header>

      <main style={mainWrap}>
        <section style={boardGrid}>
          <article style={card}>
            <h2 style={cardTitle}>Individual Address Lookup</h2>
            <div style={tabs}>
              <button
                style={{ ...tabButton, ...(addressMode === "jibun" ? tabButtonActive : {}) }}
                onClick={() => setAddressMode("jibun")}
              >
                Ji-beon Address
              </button>
              <button
                style={{ ...tabButton, ...(addressMode === "road" ? tabButtonActive : {}) }}
                onClick={() => setAddressMode("road")}
              >
                Road Name Address
              </button>
            </div>

            {addressMode === "jibun" ? (
              <div style={formGrid}>
                <div style={row}>
                  <input style={input} placeholder="Province" value={jibunProvince} onChange={(e) => setJibunProvince(e.target.value)} />
                  <input style={input} placeholder="City" value={jibunCity} onChange={(e) => setJibunCity(e.target.value)} />
                </div>
                <input style={input} placeholder="Dong" value={jibunDong} onChange={(e) => setJibunDong(e.target.value)} />
                <div style={row}>
                  <input style={input} placeholder="Main No" value={jibunMainNo} onChange={(e) => setJibunMainNo(e.target.value)} />
                  <input style={input} placeholder="Sub No (optional)" value={jibunSubNo} onChange={(e) => setJibunSubNo(e.target.value)} />
                </div>
              </div>
            ) : (
              <div style={formGrid}>
                <div style={row}>
                  <input style={input} placeholder="Province" value={roadProvince} onChange={(e) => setRoadProvince(e.target.value)} />
                  <input style={input} placeholder="City" value={roadCity} onChange={(e) => setRoadCity(e.target.value)} />
                </div>
                <input style={input} placeholder="Road Name" value={roadName} onChange={(e) => setRoadName(e.target.value)} />
                <input style={input} placeholder="Building No" value={roadBuildingNo} onChange={(e) => setRoadBuildingNo(e.target.value)} />
              </div>
            )}

            <button style={searchButton} onClick={runAddressSearch}>
              Search
            </button>
            <p style={hintText}>{searchMessage}</p>
          </article>

          <article style={card}>
            <h2 style={cardTitle}>Bulk Excel Lookup (Max 10,000 rows)</h2>
            <div style={uploadDropzone}>
              <div style={excelIcon}>X</div>
              <p style={{ margin: 0 }}>Click or Drag &amp; Drop Excel File to Upload</p>
            </div>

            <div style={bulkBottomGrid}>
              <button
                style={{ ...processButton, ...(isLoggedIn ? {} : disabledButton) }}
                onClick={triggerExcelAction}
              >
                Process Async
              </button>

              <div style={statusCard}>
                <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Task Status</h3>
                <p style={{ margin: "0 0 8px", color: "#334155" }}>Processing Excel: 6,500 / 10,000 rows, 65%</p>
                <div style={progressTrack}>
                  <div style={{ ...progressFill, width: "65%" }} />
                </div>
                <p style={{ margin: "10px 0 0", color: isLoggedIn ? "#15803d" : "#b45309", fontWeight: 600 }}>
                  {isLoggedIn ? "Celery/Redis worker active" : "로그인 후 활성화"}
                </p>
              </div>
            </div>

            <p style={hintText}>{uploadMessage}</p>
          </article>
        </section>

        <section style={historyCard}>
          <h2 style={{ ...cardTitle, marginBottom: 14 }}>Recent History</h2>
          <table style={table}>
            <thead>
              <tr style={tableHeaderRow}>
                <th style={th}>Task ID</th>
                <th style={th}>Type</th>
                <th style={th}>Timestamp</th>
                <th style={th}>Total Rows</th>
                <th style={th}>Status</th>
                <th style={th}>Download</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_HISTORY.map((row) => (
                <tr key={row.taskId}>
                  <td style={td}>{row.taskId}</td>
                  <td style={td}>{row.type}</td>
                  <td style={td}>{row.timestamp}</td>
                  <td style={td}>{row.totalRows}</td>
                  <td style={td}>
                    <span style={{ ...statusBadge, ...statusStyle[row.status] }}>{row.status}</span>
                  </td>
                  <td style={td}>
                    <button style={downloadButton} onClick={() => setSearchMessage("다운로드 API 연동 예정입니다.")}>
                      ↓
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div style={healthChipWrap}>
          <button style={healthButton} onClick={checkApiHealth}>
            API 상태 확인
          </button>
          <span style={healthChip}>{healthMessage}</span>
        </div>
      </main>

      {authOpen ? (
        <div style={modalBackdrop} onClick={() => setAuthOpen(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{authMode === "login" ? "로그인" : "회원가입"}</h3>
              <button style={closeButton} onClick={() => setAuthOpen(false)}>
                ✕
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button style={{ ...tabButton, ...(authMode === "login" ? tabButtonActive : {}) }} onClick={() => setAuthMode("login")}>
                로그인
              </button>
              <button style={{ ...tabButton, ...(authMode === "register" ? tabButtonActive : {}) }} onClick={() => setAuthMode("register")}>
                회원가입
              </button>
            </div>

            {authMode === "login" ? (
              <div style={formGrid}>
                <input style={input} placeholder="이메일" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                <input
                  style={input}
                  placeholder="비밀번호"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
                <button style={searchButton} onClick={submitLogin} disabled={authLoading}>
                  {authLoading ? "처리 중..." : "로그인"}
                </button>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setAuthMessage("아이디 찾기 기능은 준비 중입니다.")} style={linkButton}>
                    아이디 찾기
                  </button>
                  <button type="button" onClick={() => setAuthMessage("비밀번호 찾기 기능은 준비 중입니다.")} style={linkButton}>
                    비밀번호 찾기
                  </button>
                </div>
              </div>
            ) : (
              <div style={formGrid}>
                <input
                  style={input}
                  placeholder="닉네임 (2~20자, 한글/영문/숫자)"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                />
                <input
                  style={input}
                  placeholder="이메일"
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                />
                <input
                  style={input}
                  placeholder="비밀번호 (8~16자, 영문/숫자/특수문자)"
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                />
                <input
                  style={input}
                  placeholder="비밀번호 확인"
                  type="password"
                  value={registerPasswordConfirm}
                  onChange={(e) => setRegisterPasswordConfirm(e.target.value)}
                />
                <label style={{ ...hintText, marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={registerAgreements}
                    onChange={(e) => setRegisterAgreements(e.target.checked)}
                  />
                  [필수] 서비스 이용약관 및 개인정보 처리방침 동의
                </label>
                <button style={searchButton} onClick={submitRegister} disabled={authLoading}>
                  {authLoading ? "처리 중..." : "회원가입"}
                </button>
              </div>
            )}

            <p style={{ ...hintText, marginTop: 12 }}>{authMessage}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (typeof detail === "object" && detail !== null) {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: unknown };
    if (first && typeof first.msg === "string" && first.msg.trim()) return first.msg;
  }
  return fallback;
}

const pageWrap: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #fafaf9 0%, #f3f4f6 100%)",
};

const topBar: CSSProperties = {
  height: 82,
  background: "rgba(255,255,255,0.95)",
  borderBottom: "1px solid #e5e7eb",
  display: "grid",
  gridTemplateColumns: "220px 1fr 260px",
  alignItems: "center",
  padding: "0 28px",
  gap: 20,
  position: "sticky",
  top: 0,
  zIndex: 10,
  backdropFilter: "blur(8px)",
};

const logoWrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  lineHeight: 1,
};

const navWrap: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 12,
};

const navButton: CSSProperties = {
  border: "none",
  borderRadius: 10,
  background: "transparent",
  color: "#334155",
  padding: "10px 14px",
  fontWeight: 600,
  cursor: "pointer",
};

const navButtonActive: CSSProperties = {
  background: "#e2e8f0",
  color: "#0f172a",
};

const authArea: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 10,
};

const authActionButton: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "8px 12px",
  background: "white",
  cursor: "pointer",
  fontWeight: 700,
  color: "#0f172a",
};

const avatar: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "#c7d2fe",
  display: "grid",
  placeItems: "center",
  fontWeight: 800,
  color: "#1e293b",
};

const mainWrap: CSSProperties = {
  maxWidth: 1700,
  margin: "0 auto",
  padding: "26px 24px 40px",
  display: "grid",
  gap: 20,
};

const boardGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 18,
};

const card: CSSProperties = {
  background: "#fffefc",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 18,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
};

const cardTitle: CSSProperties = {
  margin: "0 0 14px",
  fontSize: 34/2,
  fontWeight: 800,
  color: "#111827",
};

const tabs: CSSProperties = {
  display: "flex",
  gap: 8,
  marginBottom: 14,
  paddingBottom: 10,
  borderBottom: "1px solid #e5e7eb",
};

const tabButton: CSSProperties = {
  border: "none",
  borderRadius: 8,
  background: "transparent",
  color: "#64748b",
  fontWeight: 700,
  padding: "8px 10px",
  cursor: "pointer",
};

const tabButtonActive: CSSProperties = {
  color: "#1d4ed8",
  background: "#dbeafe",
};

const formGrid: CSSProperties = {
  display: "grid",
  gap: 10,
};

const row: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const input: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "11px 12px",
  fontSize: 14,
  background: "#fff",
  outline: "none",
};

const searchButton: CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "12px 14px",
  cursor: "pointer",
  background: "linear-gradient(90deg, #4f82db 0%, #6c8ef0 100%)",
  color: "white",
  fontWeight: 700,
  marginTop: 10,
};

const hintText: CSSProperties = {
  margin: "10px 0 0",
  color: "#475569",
  fontSize: 14,
};

const uploadDropzone: CSSProperties = {
  border: "1px dashed #94a3b8",
  borderRadius: 12,
  minHeight: 140,
  display: "grid",
  placeItems: "center",
  color: "#334155",
  background: "#fff",
  textAlign: "center",
  padding: "8px 14px",
};

const excelIcon: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  background: "#16a34a",
  color: "white",
  fontWeight: 800,
  display: "grid",
  placeItems: "center",
  marginBottom: 8,
};

const bulkBottomGrid: CSSProperties = {
  marginTop: 12,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const processButton: CSSProperties = {
  border: "none",
  borderRadius: 12,
  background: "linear-gradient(120deg, #5a86e8 0%, #4f7bdc 100%)",
  color: "white",
  fontWeight: 800,
  fontSize: 18,
  cursor: "pointer",
  minHeight: 120,
};

const disabledButton: CSSProperties = {
  opacity: 0.45,
  cursor: "not-allowed",
};

const statusCard: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 12,
  background: "#fff",
};

const progressTrack: CSSProperties = {
  width: "100%",
  height: 10,
  background: "#e2e8f0",
  borderRadius: 999,
  overflow: "hidden",
};

const progressFill: CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg, #4f82db 0%, #6c8ef0 100%)",
};

const historyCard: CSSProperties = {
  ...card,
  paddingTop: 16,
};

const table: CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const tableHeaderRow: CSSProperties = {
  background: "#f1f5f9",
};

const th: CSSProperties = {
  textAlign: "left",
  padding: "11px 12px",
  fontSize: 14,
  color: "#334155",
  borderBottom: "1px solid #e2e8f0",
};

const td: CSSProperties = {
  padding: "11px 12px",
  borderBottom: "1px solid #f1f5f9",
  color: "#1f2937",
  fontSize: 14,
};

const statusBadge: CSSProperties = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
};

const statusStyle: Record<HistoryRow["status"], CSSProperties> = {
  완료: { background: "#dcfce7", color: "#166534" },
  진행중: { background: "#dbeafe", color: "#1d4ed8" },
  실패: { background: "#fee2e2", color: "#991b1b" },
};

const downloadButton: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "white",
  cursor: "pointer",
  width: 32,
  height: 32,
};

const healthChipWrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  justifyContent: "flex-end",
};

const healthButton: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "white",
  padding: "7px 10px",
  cursor: "pointer",
};

const healthChip: CSSProperties = {
  borderRadius: 999,
  background: "#e2e8f0",
  color: "#334155",
  padding: "7px 12px",
  fontWeight: 700,
  fontSize: 13,
};

const modalBackdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.28)",
  display: "grid",
  placeItems: "center",
  zIndex: 20,
};

const modalCard: CSSProperties = {
  width: "min(520px, calc(100vw - 24px))",
  background: "#fffefc",
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  padding: 18,
  boxShadow: "0 16px 40px rgba(15,23,42,0.25)",
};

const closeButton: CSSProperties = {
  border: "none",
  borderRadius: 8,
  width: 30,
  height: 30,
  cursor: "pointer",
  background: "#f1f5f9",
};

const linkButton: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#2563eb",
  cursor: "pointer",
  padding: 0,
  textDecoration: "underline",
  textUnderlineOffset: "2px",
  fontWeight: 600,
};

