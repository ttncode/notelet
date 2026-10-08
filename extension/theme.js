const THEMES = ["system", "light", "dark"];
const LABELS = { system: "System", light: "Light", dark: "Dark" };

const knownTheme = (theme) => (THEMES.includes(theme) ? theme : "system");

export const nextTheme = (theme) => THEMES[(THEMES.indexOf(knownTheme(theme)) + 1) % THEMES.length];

export const themeLabel = (theme) => `Theme: ${LABELS[knownTheme(theme)]}`;

export function applyTheme(theme) {
  const known = knownTheme(theme);
  if (known === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = known;
}
