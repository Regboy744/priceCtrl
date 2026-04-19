import { ref, watch } from 'vue'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

const theme = ref<Theme>('light')
const isDark = ref(false)

function getSystemPreference(): Theme {
 if (typeof window === 'undefined') return 'light'
 return window.matchMedia('(prefers-color-scheme: dark)').matches
  ? 'dark'
  : 'light'
}

function applyTheme(newTheme: Theme) {
 const root = document.documentElement
 if (newTheme === 'dark') {
  root.classList.add('dark')
 } else {
  root.classList.remove('dark')
 }
}

// One-time module-scoped init. The `theme` ref is shared across every
// `useTheme()` caller, so the listener must be attached once — not once per
// component mount (which leaks listeners on every route change / re-render).
if (typeof window !== 'undefined') {
 const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
 theme.value = saved || getSystemPreference()
 applyTheme(theme.value)
 isDark.value = theme.value === 'dark'

 watch(
  theme,
  (newTheme) => {
   isDark.value = newTheme === 'dark'
   applyTheme(newTheme)
   localStorage.setItem(STORAGE_KEY, newTheme)
  },
  { immediate: false },
 )

 const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
 mediaQuery.addEventListener('change', (e: MediaQueryListEvent) => {
  // Only auto-switch if user hasn't set an explicit preference
  if (!localStorage.getItem(STORAGE_KEY)) {
   theme.value = e.matches ? 'dark' : 'light'
  }
 })
}

export function useTheme() {
 function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
 }

 function setTheme(newTheme: Theme) {
  theme.value = newTheme
 }

 return {
  theme,
  isDark,
  toggleTheme,
  setTheme,
 }
}
