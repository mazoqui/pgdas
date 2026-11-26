import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const KEY = "theme";
const query = () => window.matchMedia("(prefers-color-scheme: dark)");

/** Browser storage can be missing or throw (private windows, blocked site data): the theme is only a convenience. */
const load = (): Theme => {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
};

const save = (theme: Theme) => {
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Not remembered, still applied.
  }
};

const apply = (theme: Theme) => {
  const dark = theme === "dark" || (theme === "system" && query().matches);
  document.documentElement.classList.toggle("dark", dark);
};

/** The chosen theme, applied to <html>. "system" follows the OS, also when it changes while the page is open. */
export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(load);

  useEffect(() => {
    apply(theme);
    save(theme);
    if (theme !== "system") return;
    const media = query();
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  return [theme, setTheme] as const;
};
