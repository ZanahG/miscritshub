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

  // ===============================
  // Mobile menu toggle
  // ===============================
  toggle?.addEventListener("click", () => {
    const open = menu.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
    if (!open) closeAllDropdowns();
  });

  // ===============================
  // Dropdown behavior:
  // - Mobile: click to toggle (como ya tenías)
  // - Desktop: hover "sticky" con delay para evitar que se cierre al bajar
  // ===============================
  dropdowns.forEach(dd => {
    const btn = dd.querySelector(".nav__dropBtn");
    if (!btn) return;

    let closeTimer = null;

    const openDD = () => {
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = null;

      // En desktop, cierra otros y abre este
      if (!isMobile()) {
        dropdowns.forEach(other => {
          if (other !== dd) other.classList.remove("is-open");
          const ob = other.querySelector(".nav__dropBtn");
          if (ob) ob.setAttribute("aria-expanded", String(other === dd));
        });
      }

      dd.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
    };

    const scheduleCloseDD = () => {
      if (isMobile()) return;
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        dd.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
      }, 160); // delay anti-gap
    };

    // Mobile click toggle (solo mobile)
    btn.addEventListener("click", (e) => {
      if (!isMobile()) return; // desktop no click obligatorio
      e.preventDefault();

      const willOpen = !dd.classList.contains("is-open");
      closeAllDropdowns();
      dd.classList.toggle("is-open", willOpen);
      btn.setAttribute("aria-expanded", String(willOpen));
    });

    // Desktop hover sticky: enter/leave tanto del contenedor como del panel
    dd.addEventListener("mouseenter", () => {
      if (isMobile()) return;
      openDD();
    });

    dd.addEventListener("mouseleave", () => {
      if (isMobile()) return;
      scheduleCloseDD();
    });

    // También, si el foco entra por teclado, mantenlo abierto
    dd.addEventListener("focusin", () => {
      if (isMobile()) return;
      openDD();
    });

    dd.addEventListener("focusout", () => {
      if (isMobile()) return;
      scheduleCloseDD();
    });
  });

  // Click fuera: cierra todo en desktop; en mobile cierra menú
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    const clickedInsideNav = target.closest(".nav");
    if (!clickedInsideNav) {
      if (isMobile()) closeMobileMenu();
      else closeAllDropdowns();
      return;
    }

    if (isMobile()) {
      const isLink = target.closest("a");
      if (isLink) closeMobileMenu();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (isMobile()) closeMobileMenu();
      else closeAllDropdowns();
    }
  });

  window.addEventListener("resize", () => {
    if (!isMobile()) {
      menu?.classList.remove("is-open");
      toggle?.setAttribute("aria-expanded", "false");
      closeAllDropdowns();
    }
  });
})();
