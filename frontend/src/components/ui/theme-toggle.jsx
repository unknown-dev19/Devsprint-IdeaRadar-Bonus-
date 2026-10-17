// SyntaxUI theme toggle: a quiet icon button that swaps sun / moon. Persists to localStorage
// under the same key index.html reads before first paint.
import { useState } from "react";
import { Icon } from "./icons";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const flip = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("idearadar-theme", next ? "dark" : "light");
    } catch {
      /* private mode: fine */
    }
    setDark(next);
  };
  return (
    <button
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="flex size-8 items-center justify-center rounded-md text-neutral-900 outline-none transition hover:bg-zinc-900/5 focus-visible:ring-2 focus-visible:ring-red-500/60 dark:text-white dark:hover:bg-white/5"
      onClick={flip}
      type="button"
    >
      <Icon className="size-5" name={dark ? "sun" : "moon"} />
    </button>
  );
}
