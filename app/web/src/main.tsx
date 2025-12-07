import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import {
  PlatformProvider,
  setLanguageStorageAdapter,
  AuthProvider,
  initializeSupabase,
  QueryClient,
  QueryClientProvider,
  createLogger,
  getLoggerConfig
} from "@ace-ielts/core"
import "@ace-ielts/core/i18n"

import "./styles/globals.css"
import { App } from "./App"
import { webPlatformContext, webLanguageStorageAdapter } from "./adapters"

// Initialize logger for app startup
const logger = createLogger("App")
logger.info("Application starting", { 
  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV 
})

// Log logger configuration in development
if (import.meta.env.DEV) {
  const config = getLoggerConfig()
  // eslint-disable-next-line no-console
  console.log(
    "%c[Logger] Current configuration:",
    "color: #8B5CF6; font-weight: bold",
    config
  )
}

// Configure i18n with web storage
setLanguageStorageAdapter(webLanguageStorageAdapter)

// Initialize Supabase with environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY")
}

initializeSupabase({
  supabaseUrl,
  supabaseAnonKey
})

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 1
    }
  }
})

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <PlatformProvider context={webPlatformContext}>
        <BrowserRouter>
          <AuthProvider redirectTo={`${window.location.origin}/auth/callback`}>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </PlatformProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
