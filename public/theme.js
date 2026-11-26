// Applies the saved theme before the page paints, so a dark page never flashes white.
// A file, not an inline script: the built page's Content-Security-Policy forbids inline ones.
// Keep in step with src/lib/theme.ts.
(function () {
  var choice = "system";
  try {
    choice = localStorage.getItem("theme") || "system";
  } catch {
    // Storage blocked: follow the system.
  }
  var dark = choice === "dark" || (choice !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
})();
