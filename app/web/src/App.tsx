import React from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import {
  Dashboard,
  VocabularyBooks,
  VocabularyBookDetail,
  VocabularyLearning,
  Login,
  AuthCallback,
  Settings
} from "@ace-ielts/ui"
import { useAuth } from "@ace-ielts/core"

import { LandingPage } from "./pages/LandingPage"

/**
 * Protected route wrapper
 * Redirects to login if not authenticated
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-8 h-8 border-4 border-[#0E7569] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

/**
 * Main App component for Web application
 * Handles routing between Landing page and Dashboard
 */
export function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Protected routes */}
      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vocabulary"
        element={
          <ProtectedRoute>
            <VocabularyBooks />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vocabulary/:bookId"
        element={
          <ProtectedRoute>
            <VocabularyBookDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vocabulary/:bookId/learn"
        element={
          <ProtectedRoute>
            <VocabularyLearning />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App


