/**
 * Sidebar Navigation Component
 * AI-Enhanced Design System - Sage Theme
 */

import React from "react"
import { motion } from "framer-motion"
import {
  BookOpen,
  FileText,
  Headphones,
  LayoutDashboard,
  MessageSquare,
  Mic,
  PenTool,
  Settings,
  User,
  Sparkles
} from "lucide-react"
import { cn, useTranslation } from "@ace-ielts/core"

/**
 * Navigation item configuration
 */
interface NavItem {
  id: string
  labelKey: string
  icon: React.ElementType
  href?: string
  isAI?: boolean
}

/**
 * Dashboard navigation items
 */
const dashboardNavItems: NavItem[] = [
  { id: "dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard }
]

/**
 * Skills navigation items
 */
const skillsNavItems: NavItem[] = [
  { id: "listening", labelKey: "nav.listening", icon: Headphones },
  { id: "reading", labelKey: "nav.reading", icon: BookOpen },
  { id: "writing", labelKey: "nav.writing", icon: PenTool, isAI: true },
  { id: "speaking", labelKey: "nav.speaking", icon: Mic, isAI: true }
]

/**
 * Study resources navigation items
 */
const resourcesNavItems: NavItem[] = [
  { id: "vocabulary", labelKey: "nav.vocabulary", icon: MessageSquare },
  { id: "grammar", labelKey: "nav.grammar", icon: FileText },
  { id: "mockTests", labelKey: "nav.mockTests", icon: FileText }
]

/**
 * Bottom navigation items
 */
const bottomNavItems: NavItem[] = [
  { id: "profile", labelKey: "nav.profile", icon: User },
  { id: "settings", labelKey: "nav.settings", icon: Settings }
]

interface SidebarProps {
  activeItem?: string
  onNavigate?: (itemId: string) => void
}

/**
 * Sidebar navigation component with AI-enhanced styling
 */
export function Sidebar({ activeItem = "dashboard", onNavigate }: SidebarProps) {
  const { t } = useTranslation()

  const handleClick = (itemId: string) => {
    onNavigate?.(itemId)
  }

  const renderNavItem = (item: NavItem, index: number) => {
    const Icon = item.icon
    const isActive = activeItem === item.id

    return (
      <motion.button
        key={item.id}
        onClick={() => handleClick(item.id)}
        className={cn(
          "nav-item w-full text-left group",
          isActive && "nav-item-active"
        )}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        whileHover={{ x: 4 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="relative">
          <Icon className={cn(
            "h-5 w-5 flex-shrink-0 transition-colors",
            item.isAI && !isActive && "text-ai-400 group-hover:text-ai"
          )} />
          {item.isAI && (
            <Sparkles className="absolute -top-1 -right-1 h-2.5 w-2.5 text-ai" />
          )}
        </div>
        <span className="text-sm flex-1">{t(item.labelKey)}</span>
        {item.isAI && (
          <span className="text-[10px] font-medium text-ai bg-ai-50 px-1.5 py-0.5 rounded">
            AI
          </span>
        )}
      </motion.button>
    )
  }

  return (
    <motion.aside 
      className="w-sidebar h-screen bg-neutral-card border-r border-neutral-border flex flex-col"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Logo */}
      <motion.div 
        className="p-lg border-b border-neutral-border"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <div className="flex items-center gap-3 justify-center">
          <div className="p-2 bg-gradient-to-br from-primary to-ai rounded-lg shadow-glow-sm">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-h2 font-bold font-brand text-gradient tracking-tight">
            {t("common.appName")}
          </h1>
        </div>
      </motion.div>

      {/* Main Navigation */}
      <nav className="flex-1 p-md overflow-y-auto scrollbar-thin">
        {/* Dashboard Section */}
        <div className="space-y-1">
          {dashboardNavItems.map((item, index) => renderNavItem(item, index))}
        </div>

        {/* Skills Section */}
        <div className="mt-lg">
          <motion.p 
            className="text-xs font-medium text-text-tertiary uppercase tracking-wider px-3 mb-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            {t("nav.sectionSkills")}
          </motion.p>
          <div className="space-y-1">
            {skillsNavItems.map((item, index) => renderNavItem(item, dashboardNavItems.length + index))}
          </div>
        </div>

        {/* Resources Section */}
        <div className="mt-lg">
          <motion.p 
            className="text-xs font-medium text-text-tertiary uppercase tracking-wider px-3 mb-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            {t("nav.sectionResources")}
          </motion.p>
          <div className="space-y-1">
            {resourcesNavItems.map((item, index) => renderNavItem(item, dashboardNavItems.length + skillsNavItems.length + index))}
          </div>
        </div>
      </nav>

      {/* Bottom Navigation */}
      <div className="p-md border-t border-neutral-border space-y-1">
        {bottomNavItems.map((item, index) => renderNavItem(item, dashboardNavItems.length + skillsNavItems.length + resourcesNavItems.length + index))}
      </div>
    </motion.aside>
  )
}

export default Sidebar
