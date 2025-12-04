/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./packages/*/src/**/*.{ts,tsx}",
    "./app/*/src/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "./web/**/*.{ts,tsx}",
    "./tabs/**/*.{ts,tsx}",
    "./popup/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      // ===========================================
      // AI-Enhanced Design System - Sage Theme
      // ===========================================
      
      colors: {
        // Primary Colors - Enhanced Teal with AI accent
        primary: {
          DEFAULT: "#0D9488",
          hover: "#0F766E",
          light: "#CCFBF1",
          50: "#F0FDFA",
          100: "#CCFBF1",
          200: "#99F6E4",
          300: "#5EEAD4",
          400: "#2DD4BF",
          500: "#14B8A6",
          600: "#0D9488",
          700: "#0F766E",
          800: "#115E59",
          900: "#134E4A"
        },
        
        // AI Accent - Purple for AI features
        ai: {
          DEFAULT: "#8B5CF6",
          light: "#A78BFA",
          dark: "#7C3AED",
          50: "#F5F3FF",
          100: "#EDE9FE",
          200: "#DDD6FE",
          300: "#C4B5FD",
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#7C3AED",
          700: "#6D28D9",
          glow: "rgba(139, 92, 246, 0.15)"
        },
        
        // Secondary Accent Colors
        accent: {
          blue: "#DBEAFE",
          purple: "#F3E8FF",
          pink: "#FCE7F3",
          orange: "#FFEDD5",
          emerald: "#D1FAE5",
          cyan: "#CFFAFE",
          rose: "#FFE4E6"
        },
        
        // Neutral Colors - Clean and modern
        neutral: {
          background: "#F9FAFB",
          card: "#FFFFFF",
          border: "#E5E7EB",
          divider: "#F3F4F6",
          hover: "#F3F4F6",
          muted: "#F1F5F9"
        },
        
        // Text Colors
        text: {
          primary: "#111827",
          secondary: "#6B7280",
          tertiary: "#9CA3AF",
          inverse: "#FFFFFF",
          muted: "#94A3B8"
        },
        
        // Functional Colors
        functional: {
          success: "#10B981",
          warning: "#F59E0B",
          error: "#EF4444",
          info: "#3B82F6"
        },
        
        // IELTS Skill Colors - Vibrant and distinct
        skill: {
          listening: "#3B82F6",
          reading: "#10B981",
          writing: "#8B5CF6",
          speaking: "#F59E0B"
        }
      },
      
      // Typography - Modern AI-friendly fonts
      fontFamily: {
        sans: ['"Inter"', '"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        display: ['"Cal Sans"', '"DM Serif Display"', "Georgia", "serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
        brand: ['"Outfit"', "system-ui", "sans-serif"]
      },
      
      fontSize: {
        // Display sizes for hero sections
        display: ["52px", { lineHeight: "1.1", fontWeight: "700", letterSpacing: "-0.02em" }],
        "display-sm": ["42px", { lineHeight: "1.15", fontWeight: "700", letterSpacing: "-0.02em" }],
        // Heading hierarchy
        h1: ["32px", { lineHeight: "1.2", fontWeight: "700", letterSpacing: "-0.01em" }],
        h2: ["24px", { lineHeight: "1.3", fontWeight: "600", letterSpacing: "-0.01em" }],
        h3: ["18px", { lineHeight: "1.4", fontWeight: "600" }],
        h4: ["16px", { lineHeight: "1.4", fontWeight: "600" }],
        // Body text
        body: ["14px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-lg": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        small: ["13px", { lineHeight: "1.5", fontWeight: "500" }],
        xs: ["12px", { lineHeight: "1.4", fontWeight: "500" }],
        caption: ["11px", { lineHeight: "1.4", fontWeight: "500" }]
      },
      
      // Border Radius - Softer, more modern
      borderRadius: {
        sm: "8px",
        DEFAULT: "12px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
        "3xl": "32px"
      },
      
      // Box Shadows - Enhanced with glow effects
      boxShadow: {
        // Standard shadows
        sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        DEFAULT: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
        md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
        lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
        xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        
        // Card shadows
        card: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)",
        "card-hover": "0 12px 28px -8px rgba(0, 0, 0, 0.12), 0 4px 8px -4px rgba(0, 0, 0, 0.08)",
        
        // Glow effects - AI style
        "glow-primary": "0 0 20px rgba(13, 148, 136, 0.15), 0 0 40px rgba(13, 148, 136, 0.1)",
        "glow-ai": "0 0 20px rgba(139, 92, 246, 0.15), 0 0 40px rgba(139, 92, 246, 0.1)",
        "glow-sm": "0 0 10px rgba(13, 148, 136, 0.1)",
        
        // Ring glow for focus states
        "ring-glow": "0 0 0 3px rgba(13, 148, 136, 0.1)",
        "ring-glow-ai": "0 0 0 3px rgba(139, 92, 246, 0.1)",
        
        // Inner shadow for depth
        inner: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)",
        "inner-glow": "inset 0 1px 0 0 rgba(255, 255, 255, 0.5)"
      },
      
      // Spacing (4px base grid)
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
        "3xl": "64px",
        "4xl": "96px"
      },
      
      // Layout
      width: {
        sidebar: "260px",
        "sidebar-collapsed": "72px"
      },
      
      maxWidth: {
        content: "1280px",
        prose: "65ch"
      },
      
      // Animation timing
      transitionDuration: {
        DEFAULT: "200ms",
        fast: "150ms",
        slow: "300ms",
        slower: "500ms"
      },
      
      transitionTimingFunction: {
        "ease-out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "ease-in-out-expo": "cubic-bezier(0.87, 0, 0.13, 1)"
      },
      
      // Custom keyframes for AI-style animations
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" }
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" }
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 20px rgba(13, 148, 136, 0.15)" },
          "50%": { opacity: "0.8", boxShadow: "0 0 30px rgba(13, 148, 136, 0.25)" }
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" }
        },
        "typing-dot": {
          "0%, 60%, 100%": { opacity: "0.3", transform: "scale(0.8)" },
          "30%": { opacity: "1", transform: "scale(1)" }
        }
      },
      
      animation: {
        "fade-in": "fade-in 0.4s ease-out forwards",
        "fade-in-up": "fade-in-up 0.5s ease-out forwards",
        "slide-in-left": "slide-in-left 0.3s ease-out forwards",
        "slide-in-right": "slide-in-right 0.3s ease-out forwards",
        "scale-in": "scale-in 0.2s ease-out forwards",
        shimmer: "shimmer 2s linear infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "gradient-shift": "gradient-shift 3s ease infinite",
        float: "float 3s ease-in-out infinite",
        "typing-dot-1": "typing-dot 1.4s ease-in-out infinite",
        "typing-dot-2": "typing-dot 1.4s ease-in-out 0.2s infinite",
        "typing-dot-3": "typing-dot 1.4s ease-in-out 0.4s infinite"
      },
      
      // Backdrop blur
      backdropBlur: {
        xs: "2px",
        sm: "4px",
        DEFAULT: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px"
      },
      
      // Background image for gradients
      backgroundImage: {
        // Primary gradients
        "gradient-primary": "linear-gradient(135deg, #0D9488 0%, #14B8A6 100%)",
        "gradient-ai": "linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)",
        "gradient-primary-ai": "linear-gradient(135deg, #0D9488 0%, #8B5CF6 100%)",
        
        // Subtle background gradients
        "gradient-subtle": "linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%)",
        "gradient-glass": "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)",
        
        // Hero gradients
        "gradient-hero": "linear-gradient(135deg, #F0FDFA 0%, #F5F3FF 50%, #FAFAFA 100%)",
        "gradient-hero-radial": "radial-gradient(ellipse at top, #CCFBF1 0%, transparent 50%)",
        
        // Mesh gradients for special sections
        "mesh-gradient": "radial-gradient(at 40% 20%, rgba(13, 148, 136, 0.08) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(139, 92, 246, 0.08) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(13, 148, 136, 0.05) 0px, transparent 50%)",
        
        // Shimmer effect
        shimmer: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)"
      }
    }
  },
  plugins: []
}
