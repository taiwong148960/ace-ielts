/**
 * Landing Page - AI-Enhanced Design System (Sage Theme)
 * Marketing page for web deployment with modern AI aesthetics
 */

import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import {
  BookOpen,
  Headphones,
  BookText,
  PenTool,
  Mic,
  ArrowRight,
  Star,
  TrendingUp,
  Zap,
  Globe,
  CheckCircle2,
  Target,
  Sparkles,
  Languages,
  ChevronDown,
  Bot,
  Brain
} from "lucide-react"
import { 
  useTranslation, 
  changeLanguage, 
  SUPPORTED_LANGUAGES,
  type LanguageCode 
} from "@ace-ielts/core"
import { Button, Card } from "@ace-ielts/ui"

/**
 * Language Switcher Component
 */
function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const currentLang = SUPPORTED_LANGUAGES.find(
    (lang) => lang.code === i18n.language
  ) || SUPPORTED_LANGUAGES[0]

  const handleLanguageChange = async (code: LanguageCode) => {
    await changeLanguage(code)
    setIsOpen(false)
  }

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-neutral-hover rounded-md transition-all duration-200"
      >
        <Languages className="h-4 w-4" />
        <span>{currentLang.nativeName}</span>
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 mt-2 w-44 bg-neutral-card rounded-xl shadow-xl border border-neutral-border overflow-hidden z-50"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full px-4 py-3 text-left text-sm font-medium transition-all duration-200 ${
                  lang.code === i18n.language
                    ? "bg-primary-50 text-primary"
                    : "text-text-secondary hover:bg-neutral-hover hover:text-text-primary"
                }`}
              >
                <span className="block">{lang.nativeName}</span>
                <span className="block text-xs opacity-60">{lang.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Navigation Header with glass morphism
 */
function Header() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-neutral-border/50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-ai rounded-lg shadow-glow-sm">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold text-text-primary">
              {t("common.appName")}
            </span>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Button
              size="sm"
              onClick={() => navigate("/login")}
              className="hidden sm:flex"
            >
              {t("landing.hero.cta")}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}

/**
 * Hero Section with AI-enhanced mesh gradient background
 */
function HeroSection() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden">
      {/* Mesh gradient background */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute inset-0 bg-mesh" />
      
      {/* Animated gradient orbs */}
      <motion.div
        className="absolute top-20 right-[10%] w-80 h-80 bg-gradient-to-br from-primary/20 to-ai/20 rounded-full blur-3xl"
        animate={{ 
          scale: [1, 1.2, 1],
          x: [0, 40, 0],
          y: [0, -30, 0]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-20 left-[5%] w-96 h-96 bg-gradient-to-br from-ai/15 to-primary/15 rounded-full blur-3xl"
        animate={{ 
          scale: [1, 1.15, 1],
          x: [0, -30, 0],
          y: [0, 40, 0]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* AI Badge */}
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-50 to-ai-50 border border-primary-200/50 rounded-full mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Sparkles className="h-4 w-4 text-ai" />
              <span className="text-sm font-medium text-gradient">
                {t("landing.hero.badge")}
              </span>
            </motion.div>

            <h1 className="font-display text-display text-text-primary mb-6 leading-tight">
              {t("landing.hero.title")}{" "}
              <span className="text-gradient">{t("landing.hero.titleHighlight")}</span>
            </h1>
            
            <p className="text-body-lg text-text-secondary mb-8 max-w-xl leading-relaxed">
              {t("landing.hero.subtitle")}
            </p>

            <div className="flex flex-wrap gap-4 mb-10">
              <Button
                variant="ai"
                size="lg"
                onClick={() => navigate("/login")}
                className="gap-2 px-8 py-6 text-base shadow-lg hover:shadow-glow-ai transition-all"
              >
                {t("landing.hero.cta")}
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="gap-2 px-8 py-6 text-base"
              >
                {t("landing.hero.secondaryCta")}
              </Button>
            </div>

            <motion.div
              className="flex items-center gap-6 text-sm text-text-secondary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-functional-success" />
                <span>{t("landing.hero.trust1")}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-functional-success" />
                <span>{t("landing.hero.trust2")}</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Preview Card */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card variant="glass" className="p-6 shadow-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-gradient-to-br from-primary to-ai rounded-xl shadow-glow-sm">
                  <Bot className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="font-display text-xl text-text-primary">
                    {t("common.appName")}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    {t("landing.hero.previewSubtitle")}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-neutral-background rounded-lg border border-neutral-border/50">
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-primary" />
                    <span className="font-medium">{t("landing.hero.currentLevel")}</span>
                  </div>
                  <span className="text-2xl font-display font-bold text-gradient">6.5</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Headphones, label: t("dashboard.skills.listening"), color: "text-skill-listening", bg: "bg-blue-50" },
                    { icon: BookText, label: t("dashboard.skills.reading"), color: "text-skill-reading", bg: "bg-emerald-50" },
                    { icon: PenTool, label: t("dashboard.skills.writing"), color: "text-skill-writing", bg: "bg-purple-50" },
                    { icon: Mic, label: t("dashboard.skills.speaking"), color: "text-skill-speaking", bg: "bg-amber-50" }
                  ].map((skill, idx) => (
                    <motion.div
                      key={skill.label}
                      className={`flex items-center gap-2 p-3 ${skill.bg} rounded-lg border border-neutral-border/30`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + idx * 0.1 }}
                    >
                      <skill.icon className={`h-4 w-4 ${skill.color}`} />
                      <span className="text-sm font-medium text-text-primary">{skill.label}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Floating badges */}
            <motion.div
              className="absolute -top-4 -right-4 bg-neutral-card p-4 rounded-xl shadow-xl border border-neutral-border/50"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, type: "spring" }}
            >
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-functional-warning fill-functional-warning" />
                <span className="font-bold text-text-primary">4.9</span>
              </div>
              <p className="text-xs text-text-secondary mt-1">{t("landing.hero.rating")}</p>
            </motion.div>

            <motion.div
              className="absolute -bottom-4 -left-4 bg-neutral-card p-4 rounded-xl shadow-xl border border-neutral-border/50"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1, type: "spring" }}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-functional-success" />
                <span className="font-bold text-text-primary">+1.5</span>
              </div>
              <p className="text-xs text-text-secondary mt-1">{t("landing.hero.improvement")}</p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/**
 * Features Section with AI-enhanced cards
 */
function FeaturesSection() {
  const { t } = useTranslation()

  const features = [
    {
      icon: Brain,
      title: t("landing.features.tracking.title"),
      description: t("landing.features.tracking.description"),
      color: "text-skill-listening",
      bg: "bg-blue-50",
      borderHover: "hover:border-skill-listening/30"
    },
    {
      icon: Zap,
      title: t("landing.features.ai.title"),
      description: t("landing.features.ai.description"),
      color: "text-ai",
      bg: "bg-ai-50",
      borderHover: "hover:border-ai/30"
    },
    {
      icon: Target,
      title: t("landing.features.practice.title"),
      description: t("landing.features.practice.description"),
      color: "text-skill-reading",
      bg: "bg-emerald-50",
      borderHover: "hover:border-skill-reading/30"
    },
    {
      icon: Globe,
      title: t("landing.features.vocabulary.title"),
      description: t("landing.features.vocabulary.description"),
      color: "text-skill-speaking",
      bg: "bg-amber-50",
      borderHover: "hover:border-skill-speaking/30"
    }
  ]

  return (
    <section className="py-24 bg-neutral-card">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-display text-h1 text-text-primary mb-4">
            {t("landing.features.title")}
          </h2>
          <p className="text-body-lg text-text-secondary max-w-2xl mx-auto">
            {t("landing.features.subtitle")}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, idx) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
            >
              <Card 
                variant="interactive"
                className={`h-full border border-neutral-border/50 ${feature.borderHover}`}
              >
                <div className={`inline-flex p-3 ${feature.bg} rounded-xl mb-4`}>
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="font-semibold text-h4 text-text-primary mb-2">
                  {feature.title}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * Skills Section with gradient icons
 */
function SkillsSection() {
  const { t } = useTranslation()

  const skills = [
    {
      icon: Headphones,
      name: t("dashboard.skills.listening"),
      description: t("landing.skills.listening"),
      gradient: "from-skill-listening to-blue-400",
      bg: "bg-blue-50"
    },
    {
      icon: BookText,
      name: t("dashboard.skills.reading"),
      description: t("landing.skills.reading"),
      gradient: "from-skill-reading to-emerald-400",
      bg: "bg-emerald-50"
    },
    {
      icon: PenTool,
      name: t("dashboard.skills.writing"),
      description: t("landing.skills.writing"),
      gradient: "from-skill-writing to-purple-400",
      bg: "bg-purple-50"
    },
    {
      icon: Mic,
      name: t("dashboard.skills.speaking"),
      description: t("landing.skills.speaking"),
      gradient: "from-skill-speaking to-amber-400",
      bg: "bg-amber-50"
    }
  ]

  return (
    <section className="py-24 bg-neutral-background">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="font-display text-h1 text-text-primary mb-4">
            {t("landing.skills.title")}
          </h2>
          <p className="text-body-lg text-text-secondary max-w-2xl mx-auto">
            {t("landing.skills.subtitle")}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {skills.map((skill, idx) => (
            <motion.div
              key={skill.name}
              initial={{ opacity: 0, x: idx % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: idx * 0.1 }}
            >
              <Card className="h-full hover:shadow-card-hover transition-all duration-300 group">
                <div className="flex items-start gap-5">
                  <div 
                    className={`p-4 rounded-2xl bg-gradient-to-br ${skill.gradient} shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}
                  >
                    <skill.icon className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-xl text-text-primary mb-2">
                      {skill.name}
                    </h3>
                    <p className="text-text-secondary leading-relaxed">
                      {skill.description}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * CTA Section with gradient background
 */
function CTASection() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-700 to-ai" />
      
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-mesh opacity-30" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="font-display text-h1 text-white mb-6">
            {t("landing.cta.title")}
          </h2>
          <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto">
            {t("landing.cta.subtitle")}
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/login")}
            className="gap-2 px-10 py-6 text-lg bg-white text-primary hover:bg-white/90 shadow-xl hover:shadow-2xl transition-all"
          >
            {t("landing.cta.button")}
            <ArrowRight className="h-5 w-5" />
          </Button>
        </motion.div>
      </div>
    </section>
  )
}

/**
 * Footer with dark theme
 */
function Footer() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="py-12 bg-text-primary">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-ai rounded-lg">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-xl text-white">
              {t("common.appName")}
            </span>
          </div>
          
          <nav className="flex items-center gap-8">
            <a href="#" className="text-white/60 hover:text-white transition-colors text-sm">
              {t("landing.footer.about")}
            </a>
            <a href="#" className="text-white/60 hover:text-white transition-colors text-sm">
              {t("landing.footer.privacy")}
            </a>
            <a href="#" className="text-white/60 hover:text-white transition-colors text-sm">
              {t("landing.footer.terms")}
            </a>
            <a href="#" className="text-white/60 hover:text-white transition-colors text-sm">
              {t("landing.footer.contact")}
            </a>
          </nav>

          <p className="text-white/40 text-sm">
            © {currentYear} {t("common.appName")}. {t("landing.footer.rights")}
          </p>
        </div>
      </div>
    </footer>
  )
}

/**
 * Landing Page - Main marketing page for web deployment
 */
export function LandingPage() {
  return (
    <div className="min-h-screen bg-neutral-card">
      <Header />
      <main className="pt-16">
        <HeroSection />
        <FeaturesSection />
        <SkillsSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}

export default LandingPage
