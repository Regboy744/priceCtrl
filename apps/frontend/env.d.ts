/// <reference types="vite/client" />
/// <reference types="unplugin-vue-router/client" />

// Environment variables type declarations
interface ImportMetaEnv {
 readonly VITE_SUPABASE_URL: string
 readonly VITE_SUPABASE_KEY: string
 readonly VITE_SB_PUBLISHABLE_KEY: string
 readonly VITE_SB_SECRET_KEY: string
 readonly VITE_SERVICE_ROLE_KEY: string
 readonly VITE_API_URL: string
 readonly VITE_DEV_COMPANY_ID?: string
 readonly BASE_URL: string
 readonly MODE: string
 readonly DEV: boolean
 readonly PROD: boolean
 readonly SSR: boolean
}

interface ImportMeta {
 readonly env: ImportMetaEnv
 readonly hot?: {
  accept: (callback?: (newModule: unknown) => void) => void
  dispose: (callback: (data: unknown) => void) => void
  data: unknown
 }
}

// Vue component module declarations
declare module '*.vue' {
 import type { DefineComponent } from 'vue'
 const component: DefineComponent<
  Record<string, unknown>,
  Record<string, unknown>,
  unknown
 >
 export default component
}
