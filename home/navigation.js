(() => {
  const sheet = document.querySelector(".sheet");
  const links = Array.from(document.querySelectorAll(".switcher a"));
  function updateDirectory(focusHeading) {
    const selected = links.find(link => link.hash === location.hash);
    sheet.toggleAttribute("data-directory", Boolean(selected));
    for (const link of links) {
      link.setAttribute("aria-expanded", String(link === selected));
    }
    if (selected && focusHeading) {
      document.querySelector(selected.hash + " h2").focus({ preventScroll: true });
    }
  }
  for (const link of links) {
    link.addEventListener("click", event => {
      if (link.hash !== location.hash) return;
      event.preventDefault();
      location.hash = "home";
      updateDirectory(false);
    });
  }
  window.addEventListener("hashchange", () => updateDirectory(true));
  window.addEventListener("keydown", event => {
    const active = links.find(link => link.hash === location.hash);
    if (event.key === "Escape" && active) {
      location.hash = "home";
      updateDirectory(false);
      active.focus({ preventScroll: true });
    }
  });
  window.addEventListener("pageshow", () => updateDirectory(false));
  updateDirectory(false);
})();
