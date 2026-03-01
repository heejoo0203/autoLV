"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/app/components/auth-provider";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, openAuth, logout } = useAuth();

  const isLoggedIn = Boolean(user);
  const userLabel = user?.full_name?.trim() || user?.email || "사용자";

  return (
    <div className="app-shell">
      <header className="top-nav">
        <Link href="/search" className="brand">
          <span className="brand-auto">auto</span>
          <span className="brand-lv">LV</span>
        </Link>

        {!isLoggedIn ? (
          <nav className="center-nav">
            <Link href="/search" className={`nav-item ${pathname === "/search" ? "active" : ""}`}>
              개별조회
            </Link>
            <button className="nav-item" onClick={() => openAuth("login")}>
              로그인
            </button>
            <button className="nav-item primary" onClick={() => openAuth("register")}>
              회원가입
            </button>
          </nav>
        ) : (
          <nav className="center-nav">
            <Link href="/search" className={`nav-item ${pathname === "/search" ? "active" : ""}`}>
              개별조회
            </Link>
            <Link href="/files" className={`nav-item ${pathname === "/files" ? "active" : ""}`}>
              파일조회
            </Link>
            <Link href="/history" className={`nav-item ${pathname === "/history" ? "active" : ""}`}>
              조회기록
            </Link>
          </nav>
        )}

        <div className="right-profile">
          {isLoggedIn ? (
            <>
              <div className="avatar">{userLabel.charAt(0).toUpperCase()}</div>
              <span className="profile-name">{userLabel}</span>
              <button
                className="nav-item subtle"
                onClick={async () => {
                  await logout();
                  router.push("/search");
                }}
              >
                로그아웃
              </button>
            </>
          ) : (
            <span className="profile-name guest">비로그인</span>
          )}
        </div>
      </header>
      <main className="content-wrap">{children}</main>
    </div>
  );
}

