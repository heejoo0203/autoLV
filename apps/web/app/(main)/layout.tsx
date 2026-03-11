"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/app/components/auth-provider";
import { BrandLogo } from "@/app/components/brand-logo";

type NavItem = {
  label: string;
  href: string;
  key: string;
  requiresAuth?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { key: "features", label: "서비스 소개", href: "/features" },
  { key: "map", label: "지도 분석", href: "/map" },
  { key: "search", label: "개별 조회", href: "/search" },
  { key: "files", label: "파일 분석", href: "/files", requiresAuth: true },
  { key: "history", label: "이용내역", href: "/history", requiresAuth: true },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, openAuth, logout } = useAuth();
  const isMapRoute = pathname.startsWith("/map");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLoggedIn = Boolean(user);
  const visibleNavItems = isMapRoute ? NAV_ITEMS.filter((item) => item.key !== "files") : NAV_ITEMS;
  useEffect(() => {
    document.body.classList.toggle("map-route-active", isMapRoute);
    return () => {
      document.body.classList.remove("map-route-active");
    };
  }, [isMapRoute]);

  const activeKey =
    pathname === "/"
      ? "features"
      : pathname.startsWith("/map")
        ? "map"
        : pathname.startsWith("/search")
          ? "search"
          : pathname.startsWith("/files")
            ? "files"
            : pathname.startsWith("/history")
              ? "history"
              : pathname.startsWith("/features")
                ? "features"
                : "";
  const pageTitle = pathname.startsWith("/mypage")
    ? "마이페이지"
    : pathname.startsWith("/privacy")
      ? "개인정보처리방침"
      : pathname.startsWith("/account-deletion")
        ? "계정 삭제"
        : NAV_ITEMS.find((item) => item.key === activeKey)?.label ?? "필지랩";

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const openProtected = (href: string) => {
    if (!isLoggedIn) {
      openAuth("login");
      return;
    }
    router.push(href);
  };

  return (
    <div className={`app-shell ${isMapRoute ? "app-shell-map" : ""}`}>
      <header className={`lab-header ${isMapRoute ? "lab-header-slim lab-header-floating" : ""}`}>
        <BrandLogo href="/features" size={isMapRoute ? "sm" : "md"} withTagline={!isMapRoute} />

        <div className="lab-header-context" aria-label="현재 페이지">
          <span>{pageTitle}</span>
        </div>

        <nav className="lab-header-nav" aria-label="주요 메뉴">
          {visibleNavItems.map((item) =>
            item.requiresAuth && !isLoggedIn ? (
              <button
                key={item.key}
                type="button"
                className={`lab-nav-link ${activeKey === item.key ? "active" : ""}`}
                onClick={() => openProtected(item.href)}
              >
                {item.label}
              </button>
            ) : (
              <Link key={item.key} href={item.href} className={`lab-nav-link ${activeKey === item.key ? "active" : ""}`}>
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="lab-header-actions">
          {isLoggedIn ? (
            <>
              <Link href="/mypage" className={`lab-nav-link subtle ${pathname === "/mypage" ? "active" : ""}`}>
                마이페이지
              </Link>
              <button
                className="lab-nav-link danger"
                type="button"
                onClick={async () => {
                  await logout();
                  router.push("/features");
                }}
              >
                로그아웃
              </button>
            </>
          ) : (
            <button className="lab-nav-link filled" type="button" onClick={() => openAuth("login")}>
              로그인
            </button>
          )}
        </div>

        <button
          type="button"
          className={`lab-header-mobile-toggle ${mobileMenuOpen ? "active" : ""}`}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu-sheet"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
        >
          {mobileMenuOpen ? "닫기" : "메뉴"}
        </button>
      </header>

      <main className={`content-wrap ${pathname === "/map" ? "content-wrap-bleed content-wrap-map" : ""}`}>{children}</main>

      {isMapRoute ? null : (
        <footer className="site-footer">
          <Link href="/privacy">개인정보처리방침</Link>
          <span>·</span>
          <Link href="/account-deletion">계정 삭제</Link>
          <span>·</span>
          <Link href="/features">서비스 소개</Link>
        </footer>
      )}

      {isMapRoute ? null : (
        <nav className="mobile-dock" aria-label="모바일 바로가기">
          <Link href="/features" className={activeKey === "features" ? "active" : ""}>
            소개
          </Link>
          <Link href="/search" className={activeKey === "search" ? "active" : ""}>
            개별조회
          </Link>
          <Link href="/map" className={activeKey === "map" ? "active" : ""}>
            지도분석
          </Link>
          <button type="button" className={mobileMenuOpen ? "active" : ""} onClick={() => setMobileMenuOpen((prev) => !prev)}>
            메뉴
          </button>
        </nav>
      )}

      {mobileMenuOpen ? (
        <div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <aside
            id="mobile-menu-sheet"
            className="mobile-menu-sheet"
            aria-label="모바일 메뉴"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mobile-menu-head">
              <strong>{pageTitle}</strong>
              <button type="button" className="lab-nav-link subtle" onClick={() => setMobileMenuOpen(false)}>
                닫기
              </button>
            </div>

            <div className="mobile-menu-group">
              {visibleNavItems.map((item) =>
                item.requiresAuth && !isLoggedIn ? (
                  <button
                    key={item.key}
                    type="button"
                    className={`mobile-menu-link ${activeKey === item.key ? "active" : ""}`}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openProtected(item.href);
                    }}
                  >
                    {item.label}
                  </button>
                ) : (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`mobile-menu-link ${activeKey === item.key ? "active" : ""}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </div>

            <div className="mobile-menu-group secondary">
              {isLoggedIn ? (
                <>
                  <Link href="/mypage" className={`mobile-menu-link ${pathname === "/mypage" ? "active" : ""}`} onClick={() => setMobileMenuOpen(false)}>
                    마이페이지
                  </Link>
                  <button
                    type="button"
                    className="mobile-menu-link danger"
                    onClick={async () => {
                      setMobileMenuOpen(false);
                      await logout();
                      router.push("/features");
                    }}
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="mobile-menu-link filled"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openAuth("login");
                  }}
                >
                  로그인
                </button>
              )}
            </div>

            <div className="mobile-menu-group tertiary">
              <Link href="/privacy" className="mobile-menu-link subtle" onClick={() => setMobileMenuOpen(false)}>
                개인정보처리방침
              </Link>
              <Link href="/account-deletion" className="mobile-menu-link subtle" onClick={() => setMobileMenuOpen(false)}>
                계정 삭제
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
