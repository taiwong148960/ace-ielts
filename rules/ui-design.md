---
trigger: always_on
---

# UI & Design System

## Component Selection Hierarchy

1. **Primary:** shadcn/ui components
2. **Secondary:** Radix UI primitives (if missing in shadcn)
3. **Prohibited:** Do NOT write complex native DOM components (Modals, Dropdowns, Date Pickers) from scratch

---

## Color Palette

### Primary
| Token | Value | Tailwind |
|-------|-------|----------|
| Primary | `#0D9488` | `primary` |
| Primary Hover | `#0F766E` | `primary-hover` |
| Primary Light | `#CCFBF1` | `primary-100` |
| Primary 50 | `#F0FDFA` | `primary-50` |

### AI Accent (for AI features)
| Token | Value | Tailwind |
|-------|-------|----------|
| AI Main | `#8B5CF6` | `ai` |
| AI Light | `#A78BFA` | `ai-light` |
| AI Dark | `#7C3AED` | `ai-dark` |
| AI 200 | `#DDD6FE` | `ai-200` |
| AI 300 | `#C4B5FD` | `ai-300` |
| AI Glow | `rgba(139, 92, 246, 0.15)` | - |

### Neutral
| Token | Value | Tailwind |
|-------|-------|----------|
| Background | `#F9FAFB` | `neutral-background` |
| Card/Surface | `#FFFFFF` | `neutral-card` |
| Muted | `#F1F5F9` | `neutral-muted` |
| Border | `#E5E7EB` | `neutral-border` |
| Hover | `#F3F4F6` | `neutral-hover` |

### Text
| Token | Value | Tailwind |
|-------|-------|----------|
| Primary | `#111827` | `text-primary` |
| Secondary | `#6B7280` | `text-secondary` |
| Tertiary | `#9CA3AF` | `text-tertiary` |
| Inverse | `#FFFFFF` | `text-inverse` |

### IELTS Skills
| Skill | Color | Tailwind |
|-------|-------|----------|
| Listening | `#3B82F6` (Blue) | `skill-listening` |
| Reading | `#10B981` (Green) | `skill-reading` |
| Writing | `#8B5CF6` (Purple) | `skill-writing` |
| Speaking | `#F59E0B` (Amber) | `skill-speaking` |

### Functional
| Token | Value |
|-------|-------|
| Success | `#10B981` |
| Warning | `#F59E0B` |
| Error | `#EF4444` |
| Info | `#3B82F6` |

---

## Typography

### Font Families
| Use | Fonts |
|-----|-------|
| Body (Sans) | `Inter`, `Plus Jakarta Sans`, system-ui |
| Headings (Display) | `Cal Sans`, `DM Serif Display`, Georgia |
| Code (Mono) | `JetBrains Mono`, `Fira Code` |
| Brand | `Outfit`, system-ui |

### Font Sizes
| Token | Size | Weight | Letter Spacing |
|-------|------|--------|----------------|
| Display | 52px | Bold (700) | -0.02em |
| Display SM | 42px | Bold (700) | -0.02em |
| H1 | 32px | Bold (700) | -0.01em |
| H2 | 24px | SemiBold (600) | -0.01em |
| H3 | 18px | SemiBold (600) | - |
| H4 | 16px | SemiBold (600) | - |
| Body LG | 16px | Regular (400) | line-height: 1.6 |
| Body | 14px | Regular (400) | line-height: 1.6 |
| Small | 13px | Medium (500) | - |
| XS | 12px | Medium (500) | - |
| Caption | 11px | Medium (500) | - |

---

## Spacing & Layout

| Token | Value |
|-------|-------|
| Base Unit | 4px |
| xs | 4px |
| sm | 8px |
| md | 16px |
| lg | 24px |
| xl | 32px |
| 2xl | 48px |
| 3xl | 64px |
| Card Padding | 24px (`p-lg`) |
| Sidebar Width | 260px |
| Max Content Width | 1280px |

---

## Border Radius

| Token | Value | Tailwind |
|-------|-------|----------|
| SM | 8px | `rounded-sm` |
| MD (Default) | 12px | `rounded-md` |
| LG | 16px | `rounded-lg` |
| XL | 20px | `rounded-xl` |
| 2XL | 24px | `rounded-2xl` |
| Full | 9999px | `rounded-full` |

---

## Shadows

| Token | Use |
|-------|-----|
| `shadow-card` | Subtle elevation for cards |
| `shadow-card-hover` | Enhanced shadow on interaction |
| `shadow-glow-primary` | Teal glow for primary elements |
| `shadow-glow-ai` | Purple glow for AI features |
| `shadow-ring-glow` | Focus state glow |

---

## Component Patterns

### Buttons
```
// Primary
bg-primary text-white hover:bg-primary-hover hover:shadow-glow-primary 
active:scale-[0.98] rounded-md px-5 py-2 font-semibold

// AI Gradient
bg-gradient-to-r from-primary to-ai text-white 
hover:from-primary-hover hover:to-ai-dark hover:shadow-glow-ai
active:scale-[0.98] rounded-md px-5 py-2 font-semibold

// Secondary
bg-neutral-card text-text-primary border border-neutral-border
hover:bg-neutral-hover rounded-md px-5 py-2 font-semibold

// Ghost
text-text-secondary hover:text-primary hover:bg-primary-50
rounded-md px-4 py-2 font-medium
```

### Cards
```
// Default
bg-neutral-card rounded-md p-lg shadow-card border border-neutral-border/50
hover:shadow-card-hover transition-all

// AI Card
bg-neutral-card rounded-md p-lg shadow-card border border-ai-200/50
hover:shadow-glow-ai hover:border-ai-300/50 relative overflow-hidden

// Glass
bg-white/80 backdrop-blur-md rounded-md p-lg border border-white/50 shadow-lg
```

### Inputs
- Default border: `border-neutral-border`
- Focus: `border-primary ring-2 ring-primary/10`
- AI Focus: `border-ai ring-2 ring-ai/10`
- Height: 40px (`h-10`)
- Radius: 12px (`rounded-md`)

### Navigation Items
```
flex items-center gap-3 px-4 py-3 rounded-md
text-text-secondary font-medium
hover:bg-primary-50 hover:text-primary transition-all duration-200

// Active state
bg-primary-50 text-primary (with left accent bar)
```

---

## Animations

### Timing
| Token | Value |
|-------|-------|
| Default | 200ms ease-out |
| Fast | 150ms |
| Slow | 300ms |
| Expo Out | `cubic-bezier(0.16, 1, 0.3, 1)` |

### Common Variants (Framer Motion)
- **Fade In:** opacity 0→1, translateY 8px→0
- **Scale In:** opacity 0→1, scale 0.95→1
- **Slide In:** opacity 0→1, translateX ±12px→0
- **Pulse Glow:** Subtle shadow pulsing for AI elements

**Rule:** Use Framer Motion for interactions. Avoid complex CSS `@keyframes`.

---

## Special Effects

### Gradient Text
```css
.text-gradient {
  background: linear-gradient(135deg, #0D9488 0%, #8B5CF6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

### Mesh Background
```css
.bg-mesh {
  background-image: 
    radial-gradient(at 40% 20%, rgba(13, 148, 136, 0.08) 0px, transparent 50%),
    radial-gradient(at 80% 0%, rgba(139, 92, 246, 0.08) 0px, transparent 50%),
    radial-gradient(at 0% 50%, rgba(13, 148, 136, 0.05) 0px, transparent 50%);
}
```

---

## AI Feature Indicators

- Use `Sparkles` icon from lucide-react for AI features
- AI Badge: `text-ai bg-ai-50 px-1.5 py-0.5 rounded text-[10px] font-medium`
- Writing and Speaking skills should have AI badges in navigation

---

## Icons & Assets

- **Icons:** Lucide React exclusively (`import { IconName } from "lucide-react"`)
- **Charts:** Recharts for all data visualization
- **No Manual SVGs** except Brand Logo

---

## Internationalization

All user-facing text must use `t()` from `useTranslation`:

```typescript
// ✅ Good
<span>{t("welcome_message")}</span>

// ❌ Bad
<span>Welcome</span>
```
