"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/app/components/auth-provider";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, openAuth, logout } = useAuth();
  const [lookupMenuOpen, setLookupMenuOpen] = useState(false);
  const lookupMenuRef = useRef<HTMLDivElement | null>(null);
  const lookupMenuCloseTimerRef = useRef<number | null>(null);

  const isLoggedIn = Boolean(user);

  useEffect(() => {
    setLookupMenuOpen(false);
    if (lookupMenuCloseTimerRef.current) {
      window.clearTimeout(lookupMenuCloseTimerRef.current);
      lookupMenuCloseTimerRef.current = null;
    }
  }, [pathname]);

  useEffect(() => {
    const closeOnOutside = (event: MouseEvent) => {
      if (!lookupMenuRef.current) return;
      if (!lookupMenuRef.current.contains(event.target as Node)) {
        setLookupMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutside);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (lookupMenuCloseTimerRef.current) {
        window.clearTimeout(lookupMenuCloseTimerRef.current);
        lookupMenuCloseTimerRef.current = null;
      }
    };
  }, []);

  const openLookupMenu = () => {
    if (lookupMenuCloseTimerRef.current) {
      window.clearTimeout(lookupMenuCloseTimerRef.current);
      lookupMenuCloseTimerRef.current = null;
    }
    setLookupMenuOpen(true);
  };

  const scheduleCloseLookupMenu = () => {
    if (lookupMenuCloseTimerRef.current) {
      window.clearTimeout(lookupMenuCloseTimerRef.current);
    }
    lookupMenuCloseTimerRef.current = window.setTimeout(() => {
      setLookupMenuOpen(false);
      lookupMenuCloseTimerRef.current = null;
    }, 220);
  };

  const lookupActive = pathname === "/search" || pathname === "/map" || pathname === "/files";
  const featuresActive = pathname === "/features";
  const historyActive = pathname === "/history";
  const myPageActive = pathname === "/mypage";
  const isMapPage = pathname === "/map";

  return (
    <div className="app-shell">
      <header className="top-nav">
        <Link href="/search" className="brand">
          <span className="brand-auto">auto</span>
          <span className="brand-lv">LV</span>
        </Link>

        <nav className={`center-nav ${isLoggedIn ? "auth-nav" : "guest-nav"}`}>
          <div
            className={`nav-dropdown ${lookupActive ? "active" : ""} ${lookupMenuOpen ? "open" : ""}`}
            ref={lookupMenuRef}
            onMouseEnter={openLookupMenu}
            onMouseLeave={scheduleCloseLookupMenu}
          >
            <button
              type="button"
              className={`nav-item nav-dropdown-trigger ${lookupActive ? "active" : ""}`}
              onClick={() => {
                if (lookupMenuOpen) {
                  scheduleCloseLookupMenu();
                } else {
                  openLookupMenu();
                }
              }}
              aria-expanded={lookupMenuOpen}
            >
              조회
            </button>
            <div className="nav-dropdown-menu">
              <Link href="/search" className={`nav-dropdown-item ${pathname === "/search" ? "active" : ""}`}>
                개별조회
              </Link>
              {isLoggedIn ? (
                <>
                  <Link href="/map" className={`nav-dropdown-item ${pathname === "/map" ? "active" : ""}`}>
                    지도조회
                  </Link>
                  <Link href="/files" className={`nav-dropdown-item ${pathname === "/files" ? "active" : ""}`}>
                    파일조회
                  </Link>
                </>
              ) : null}
            </div>
          </div>

          {isLoggedIn ? (
            <Link href="/history" className={`nav-item ${historyActive ? "active" : ""}`}>
              조회기록
            </Link>
          ) : null}

          <Link href="/features" className={`nav-item ${featuresActive ? "active" : ""}`}>
            기능설명
          </Link>

          {isLoggedIn ? (
            <Link href="/mypage" className={`nav-item ${myPageActive ? "active" : ""}`}>
              마이페이지
            </Link>
          ) : null}
        </nav>

        <div className="right-profile">
          {isLoggedIn ? (
            <button
              className="nav-item danger"
              type="button"
              onClick={async () => {
                await logout();
                router.push("/search");
              }}
            >
              로그아웃
            </button>
          ) : (
            <div className="guest-actions">
              <button className="nav-item" onClick={() => openAuth("login")}>
                로그인
              </button>
            </div>
          )}
        </div>
      </header>

      <main className={`content-wrap ${isMapPage ? "content-wrap-wide" : ""}`}>{children}</main>
      <footer className="site-footer">
        <Link href="/features">기능설명</Link>
        <span>·</span>
        <Link href="/privacy">개인정보처리방침</Link>
        <span>·</span>
        <Link href="/account-deletion">계정삭제 안내</Link>
      </footer>
    </div>
  );
}
