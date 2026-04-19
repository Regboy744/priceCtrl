import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { setupAuthListener } from '@/lib/supabaseClient'
import { useAuthStore } from '@/stores/auth'

// Import the main.css - Required to make tailwind work
import './assets/main.css'

// Import vue-sonner styles for toast notifications
import 'vue-sonner/style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Initialize auth listener after Pinia is ready
const authStore = useAuthStore(pinia)

// Set up Supabase auth state listener
setupAuthListener((event, session) => {
 authStore.handleAuthStateChange(event, session)
})

app.mount('#app')
