import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import {
  PlatformProvider,
  setLanguageStorageAdapter,
  AuthProvider,
  initializeSupabase
} from "@ace-ielts/core"
import "@ace-ielts/core/i18n"

import "./styles/globals.css"
import { App } from "./App"
import { webPlatformContext, webLanguageStorageAdapter } from "./adapters"

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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PlatformProvider context={webPlatformContext}>
      <BrowserRouter>
        <AuthProvider redirectTo={`${window.location.origin}/auth/callback`}>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </PlatformProvider>
  </React.StrictMode>
)

