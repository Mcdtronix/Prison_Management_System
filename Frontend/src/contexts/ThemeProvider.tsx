import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"
export type TextSize = "standard" | "large"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  /** The theme actually applied: "system" resolves to light or dark. */
  resolvedTheme: "light" | "dark"
  textSize: TextSize
  setTextSize: (size: TextSize) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  resolvedTheme: "light",
  textSize: "standard",
  setTextSize: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

/** Root font size per text size; Tailwind sizes are rem-based, so everything scales. */
const ROOT_FONT_SIZE: Record<TextSize, string> = { standard: "", large: "112.5%" }

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable: preference lasts for this session only */
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const textSizeKey = `${storageKey}-text-size`
  const [theme, setThemeState] = useState<Theme>(() => (read(storageKey) as Theme) || defaultTheme)
  const [textSize, setTextSizeState] = useState<TextSize>(
    () => (read(textSizeKey) as TextSize) || "standard"
  )
  const [systemDark, setSystemDark] = useState(prefersDark)

  // Follow the device when the theme is "system".
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => setSystemDark(media.matches)
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])

  const resolvedTheme: "light" | "dark" = theme === "system" ? (systemDark ? "dark" : "light") : theme

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    document.documentElement.style.fontSize = ROOT_FONT_SIZE[textSize] ?? ""
  }, [textSize])

  const value: ThemeProviderState = {
    theme,
    setTheme: (next: Theme) => {
      write(storageKey, next)
      setThemeState(next)
    },
    resolvedTheme,
    textSize,
    setTextSize: (next: TextSize) => {
      write(textSizeKey, next)
      setTextSizeState(next)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
