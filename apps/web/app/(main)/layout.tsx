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
            <div className="profile-menu">
              <button className="profile-trigger" type="button">
                <div className="avatar">{userLabel.charAt(0).toUpperCase()}</div>
                <span className="profile-name">{userLabel}</span>
              </button>
              <div className="profile-dropdown">
                <button className="profile-action" type="button">
                  회원 정보 수정
                </button>
                <button className="profile-action" type="button">
                  비밀번호 변경
                </button>
                <button className="profile-action" type="button">
                  회원 탈퇴
                </button>
                <button
                  className="profile-action danger"
                  type="button"
                  onClick={async () => {
                    await logout();
                    router.push("/search");
                  }}
                >
                  로그아웃
                </button>
              </div>
            </div>
          ) : (
            <div className="guest-actions">
              <button className="nav-item" onClick={() => openAuth("login")}>
                로그인
              </button>
              <button className="nav-item primary" onClick={() => openAuth("register")}>
                회원가입
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="content-wrap">{children}</main>
    </div>
  );
}
