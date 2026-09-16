// Appearance switch: system (default), light, or dark. The choice lives in localStorage as "theme"; a blocking
// script in root.tsx applies it before first paint by setting data-theme on <html>, which the dark: variant keys on.
import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const order: Theme[] = ["system", "light", "dark"];

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "light" || stored === "dark") setTheme(stored);
    } catch {
      // storage unavailable: stay on system
    }
  }, []);
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => apply("system");
    mq.addEventListener("change", follow);
    return () => mq.removeEventListener("change", follow);
  }, [theme]);
  const next = () => {
    const t = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(t);
    try {
      if (t === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", t);
    } catch {
      // ignore
    }
    apply(t);
  };
  return (
    <button type="button" onClick={next} className={`hover:underline ${className}`} title="Switch between system, light, and dark">
      Appearance: {theme}
    </button>
  );
}
