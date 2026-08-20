(() => {
  const initialize = () => {
    const header = document.querySelector(".site-header");
    if (!header || header.dataset.sharedHeaderReady === "true") return;
    header.dataset.sharedHeaderReady = "true";

    const toggle = header.querySelector(".menu-toggle");
    const navigationId = toggle?.getAttribute("aria-controls");
    const navigation = navigationId ? document.getElementById(navigationId) : header.querySelector(".main-nav");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const setMenuOpen = (open) => {
      if (!toggle || !navigation) return;
      navigation.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
      document.body.classList.toggle("site-menu-open", open);
      if (open) header.classList.remove("site-header--hidden");
    };

    toggle?.addEventListener("click", () => setMenuOpen(toggle.getAttribute("aria-expanded") !== "true"));
    navigation?.addEventListener("click", (event) => {
      if (event.target.closest("a")) setMenuOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    });
    document.addEventListener("click", (event) => {
      if (toggle?.getAttribute("aria-expanded") === "true" && !header.contains(event.target)) setMenuOpen(false);
    });

    const AUTH_STORAGE_KEY = "dail_auth_session";
    let session = null;
    try { session = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null"); } catch {}
    const signedIn = Boolean(session?.access_token);
    document.querySelectorAll("[data-shared-account]").forEach((link) => {
      link.textContent = signedIn ? "마이페이지" : "로그인";
      link.href = signedIn ? "/account/" : "/?login=1";
      link.setAttribute("aria-label", signedIn ? "마이페이지로 이동" : "로그인하기");
    });

    const centerLink = header.querySelector("#centerDashboardLink") || (() => {
      const accountLink = header.querySelector("[data-shared-account]");
      if (!accountLink) return null;
      const link = document.createElement("a");
      link.className = "center-login-link shared-center-link";
      link.href = "/center-dashboard/";
      link.textContent = "내 센터 관리";
      link.hidden = true;
      accountLink.before(link);
      return link;
    })();

    const refreshSession = async (current, auth) => {
      if (!current?.refresh_token || !auth?.supabaseUrl || !auth?.supabaseAnonKey) return null;
      try {
        const response = await fetch(`${auth.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: { apikey: auth.supabaseAnonKey, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: current.refresh_token }),
        });
        if (!response.ok) return null;
        const next = await response.json();
        next.expires_at = Math.floor(Date.now() / 1000) + (Number(next.expires_in) || 3600);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
        return next;
      } catch { return null; }
    };

    const loadCenterAccess = async () => {
      if (!signedIn || !centerLink) return;
      try {
        let current = session;
        if (Number(current.expires_at || 0) < Math.floor(Date.now() / 1000) + 60) {
          const configResponse = await fetch("/api/config", { headers: { "X-DAIL-Source": "web" } });
          const config = await configResponse.json();
          current = await refreshSession(current, config.auth || {});
        }
        if (!current?.access_token) return;
        let response = await fetch("/api/auth/profile", {
          headers: { Authorization: `Bearer ${current.access_token}`, "X-DAIL-Source": "web" },
        });
        if (response.status === 401) {
          const configResponse = await fetch("/api/config", { headers: { "X-DAIL-Source": "web" } });
          const config = await configResponse.json();
          current = await refreshSession(current, config.auth || {});
          if (current?.access_token) {
            response = await fetch("/api/auth/profile", {
              headers: { Authorization: `Bearer ${current.access_token}`, "X-DAIL-Source": "web" },
            });
          }
        }
        if (!response.ok) return;
        const profile = await response.json();
        centerLink.hidden = !profile.centerAccess?.hasActiveMembership;
      } catch {}
    };
    loadCenterAccess();

    let previousY = Math.max(window.scrollY, 0);
    let frame = 0;

    const updateHeader = () => {
      const currentY = Math.max(window.scrollY, 0);
      const delta = currentY - previousY;

      header.classList.toggle("is-scrolled", currentY > 18);
      const menuOpen = toggle?.getAttribute("aria-expanded") === "true";
      const keepVisible = currentY < 28 || menuOpen || header.matches(":focus-within") || reducedMotion.matches;

      if (keepVisible) {
        header.classList.remove("site-header--hidden");
      } else if (delta > 1 && currentY > header.offsetHeight + 30) {
        header.classList.add("site-header--hidden");
      } else if (delta < -1) {
        header.classList.remove("site-header--hidden");
      }

      previousY = currentY;
      frame = 0;
    };

    window.addEventListener("scroll", () => {
      if (!frame) frame = window.requestAnimationFrame(updateHeader);
    }, { passive: true });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) setMenuOpen(false);
      updateHeader();
    }, { passive: true });
    header.addEventListener("focusin", () => header.classList.remove("site-header--hidden"));
    reducedMotion.addEventListener?.("change", updateHeader);
    updateHeader();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
