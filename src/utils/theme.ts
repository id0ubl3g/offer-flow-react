export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "offer-flow.theme";
const media = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

export function getTheme(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? (media?.matches ? "dark" : "light") : theme;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = resolveTheme(theme);
}

export function saveTheme(theme: Theme): void {
  try {
    if (theme === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  } catch {
    return;
  }

  applyTheme(theme);
}

export function watchSystemTheme(): void {
  media?.addEventListener("change", () => getTheme() === "system" && applyTheme("system"));
}
