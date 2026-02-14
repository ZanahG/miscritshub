(() => {
  const rootHeader = document.querySelector(".nav");
  if (!rootHeader) return;

  const toggle = rootHeader.querySelector(".nav__toggle");
  const menu = rootHeader.querySelector(".nav__menu");
  const dropdowns = Array.from(rootHeader.querySelectorAll("[data-dropdown]"));

  const isMobile = () => window.matchMedia("(max-width: 860px)").matches;

  const closeAllDropdowns = () => {
    dropdowns.forEach(dd => {
      dd.classList.remove("is-open");
      const btn = dd.querySelector(".nav__dropBtn");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  };

  const closeMobileMenu = () => {
    menu?.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
    closeAllDropdowns();
  };

  toggle?.addEventListener("click", () => {
    const open = menu.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
    if (!open) closeAllDropdowns();
  });

  dropdowns.forEach(dd => {
    const btn = dd.querySelector(".nav__dropBtn");
    btn?.addEventListener("click", (e) => {
      if (!isMobile()) return;
      e.preventDefault();

      const willOpen = !dd.classList.contains("is-open");
      closeAllDropdowns();
      dd.classList.toggle("is-open", willOpen);
      btn.setAttribute("aria-expanded", String(willOpen));
    });
  });

  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    const clickedInsideNav = target.closest(".nav");
    if (!clickedInsideNav) {
      closeMobileMenu();
      return;
    }

    if (isMobile()) {
      const isLink = target.closest("a");
      if (isLink) closeMobileMenu();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMobileMenu();
  });

  window.addEventListener("resize", () => {
    if (!isMobile()) {
      menu?.classList.remove("is-open");
      toggle?.setAttribute("aria-expanded", "false");
      closeAllDropdowns();
    }
  });
})();
