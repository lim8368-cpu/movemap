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

    document.querySelectorAll("[data-shared-account]").forEach((link) => {
      let signedIn = false;
      try {
        const session = JSON.parse(localStorage.getItem("dail_auth_session") || "null");
        signedIn = Boolean(session?.access_token);
      } catch {}
      link.textContent = signedIn ? "마이페이지" : "로그인";
      link.href = signedIn ? "/account/" : "/?login=1";
      link.setAttribute("aria-label", signedIn ? "마이페이지로 이동" : "로그인하기");
    });

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
