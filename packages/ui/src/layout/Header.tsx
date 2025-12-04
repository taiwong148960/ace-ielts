/**
 * Header Component
 * AI-Enhanced Design System - Sage Theme
 */

import { motion } from "framer-motion"
import { Github, Globe, HelpCircle, Youtube, Sparkles } from "lucide-react"
import { cn, changeLanguage, SUPPORTED_LANGUAGES, useTranslation } from "@ace-ielts/core"
import { Button } from "../components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "../components/dropdown-menu"

/**
 * X (Twitter) icon component
 */
function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

interface HeaderProps {
  className?: string
}

/**
 * Header component with AI-enhanced styling
 */
export function Header({ className }: HeaderProps) {
  const { t, i18n } = useTranslation()

  const handleLanguageChange = (langCode: string) => {
    changeLanguage(langCode as "en" | "zh")
  }

  const socialLinks = [
    { icon: XIcon, label: "X (Twitter)", href: "#" },
    { icon: Youtube, label: "YouTube", href: "#" },
    { icon: Github, label: "GitHub", href: "#" }
  ]

  return (
    <motion.header
      className={cn(
        "h-16 bg-neutral-card/80 backdrop-blur-md border-b border-neutral-border/50",
        "px-lg flex items-center justify-between",
        className
      )}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      {/* AI Status Badge */}
      <motion.div
        className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-ai-50 to-primary-50 border border-ai-200/50 rounded-full"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <Sparkles className="h-3.5 w-3.5 text-ai" />
        <span className="text-xs font-medium text-gradient">AI-Powered</span>
      </motion.div>

      {/* Right side actions */}
      <div className="flex items-center gap-md">
        {/* Help Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Button variant="ghost" size="sm" className="gap-2 text-text-secondary">
            <HelpCircle className="h-4 w-4" />
            <span>{t("common.help")}</span>
          </Button>
        </motion.div>

        {/* Social Links */}
        <div className="flex items-center gap-1">
          {socialLinks.map((link, index) => {
            const Icon = link.icon
            return (
              <motion.div
                key={link.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: 0.3 + index * 0.05 }}
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-text-secondary hover:text-text-primary"
                  aria-label={link.label}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              </motion.div>
            )
          })}
        </div>

        {/* Language Selector */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="gap-2 min-w-[100px]"
              >
                <Globe className="h-4 w-4" />
                <span>{t("common.language")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={cn(
                    i18n.language === lang.code && "bg-primary-50 text-primary"
                  )}
                >
                  {lang.nativeName}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>
      </div>
    </motion.header>
  )
}

export default Header
