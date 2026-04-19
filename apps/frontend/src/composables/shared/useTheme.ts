import { ref, watch, onMounted } from 'vue'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

const theme = ref<Theme>('light')

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

export function useTheme() {
 const isDark = ref(theme.value === 'dark')

 function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
 }

 function setTheme(newTheme: Theme) {
  theme.value = newTheme
 }

 // Watch for theme changes and apply them
 watch(
  theme,
  (newTheme) => {
   isDark.value = newTheme === 'dark'
   applyTheme(newTheme)
   localStorage.setItem(STORAGE_KEY, newTheme)
  },
  { immediate: false },
 )

 onMounted(() => {
  // Load saved theme or use system preference
  const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
  theme.value = saved || getSystemPreference()
  applyTheme(theme.value)
  isDark.value = theme.value === 'dark'

  // Listen for system preference changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleChange = (e: MediaQueryListEvent) => {
   // Only auto-switch if user hasn't set a preference
   if (!localStorage.getItem(STORAGE_KEY)) {
    theme.value = e.matches ? 'dark' : 'light'
   }
  }
  mediaQuery.addEventListener('change', handleChange)
 })

 return {
  theme,
  isDark,
  toggleTheme,
  setTheme,
 }
}
