---
trigger: always_on
---

# Monorepo Structure

## Project Layout

```
ace-ielts/
├── packages/
│   ├── core/                     # @ace-ielts/core
│   │   └── src/
│   │       ├── adapters/         # Platform adapter interfaces
│   │       ├── config/           # App & deployment config
│   │       ├── hooks/            # React Query hooks
│   │       ├── i18n/             # Internationalization
│   │       ├── services/         # API services
│   │       ├── types/            # TypeScript interfaces
│   │       └── utils/            # Utility functions
│   │
│   └── ui/                       # @ace-ielts/ui
│       └── src/
│           ├── components/       # shadcn/ui components
│           ├── dashboard/        # Dashboard widgets
│           ├── layout/           # Layout components
│           └── pages/            # Shared pages
│
├── app/
│   ├── web/                      # @ace-ielts/web
│   │   └── src/
│   │       ├── adapters/         # Web-specific adapters
│   │       ├── pages/            # Web-only pages
│   │       └── main.tsx
│   │
│   └── desktop/                  # @ace-ielts/desktop
│       ├── src/
│       │   ├── adapters/         # Desktop-specific adapters
│       │   └── main.tsx
│       └── src-tauri/            # Rust backend
│           ├── src/main.rs
│           ├── Cargo.toml
│           └── tauri.conf.json
│
└── supabase/
    ├── functions/                # Edge Functions
    ├── migrations/               # Database migrations
    └── seed.sql                  # Test data
```

---

## Code Placement Rules

| Code Type | Location | Package |
|-----------|----------|---------|
| TypeScript types/interfaces | `packages/core/src/types/` | `@ace-ielts/core` |
| API services | `packages/core/src/services/` | `@ace-ielts/core` |
| React Query hooks | `packages/core/src/hooks/` | `@ace-ielts/core` |
| i18n translations | `packages/core/src/i18n/locales/` | `@ace-ielts/core` |
| Utility functions | `packages/core/src/utils/` | `@ace-ielts/core` |
| Deployment config | `packages/core/src/config/` | `@ace-ielts/core` |
| shadcn/ui components | `packages/ui/src/components/` | `@ace-ielts/ui` |
| Layout components | `packages/ui/src/layout/` | `@ace-ielts/ui` |
| Shared pages | `packages/ui/src/pages/` | `@ace-ielts/ui` |
| Web-only pages | `app/web/src/pages/` | `@ace-ielts/web` |
| Web adapters | `app/web/src/adapters/` | `@ace-ielts/web` |
| Desktop adapters | `app/desktop/src/adapters/` | `@ace-ielts/desktop` |
| Tauri/Rust code | `app/desktop/src-tauri/` | Tauri |
| Edge Functions | `supabase/functions/` | - |
| DB migrations | `supabase/migrations/` | - |

---

## Barrel Exports

Every directory with multiple exports MUST have an `index.ts`:

```typescript
// packages/ui/src/components/index.ts
export { Button, buttonVariants, type ButtonProps } from "./button"
export { Card, CardHeader, CardContent } from "./card"
export { Progress } from "./progress"
```

**Update barrel files whenever adding new modules.**

---

## Platform Adapter Pattern

Enables code sharing across platforms with different runtime APIs.

### Core Interfaces (`@ace-ielts/core/adapters`)

```typescript
export type Platform = "web" | "desktop" | "mobile"

export interface IStorageAdapter {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
  clear(): Promise<void>
}

export interface INavigationAdapter {
  navigate(path: string): void
  openExternal(url: string): void
  getCurrentPath(): string
  goBack(): void
}

export interface IEnvironmentAdapter {
  getPlatform(): Platform
  isDevelopment(): boolean
  getBaseUrl(): string
  getApiUrl(): string
}

export interface IPlatformContext {
  platform: Platform
  storage: IStorageAdapter
  navigation: INavigationAdapter
  environment: IEnvironmentAdapter
}
```

### Implementation Example

**Web adapter:**
```typescript
// app/web/src/adapters/storage.ts
export const webStorageAdapter: IStorageAdapter = {
  async get<T>(key: string) {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : null
  },
  async set<T>(key: string, value: T) {
    localStorage.setItem(key, JSON.stringify(value))
  },
  async remove(key: string) {
    localStorage.removeItem(key)
  },
  async clear() {
    localStorage.clear()
  },
}
```

**Desktop adapter:**
```typescript
// app/desktop/src/adapters/storage.ts
import { Store } from "@tauri-apps/plugin-store"

export const desktopStorageAdapter: IStorageAdapter = {
  async get<T>(key: string) {
    const store = await Store.load("settings.json")
    return await store.get<T>(key)
  },
  async set<T>(key: string, value: T) {
    const store = await Store.load("settings.json")
    await store.set(key, value)
    await store.save()
  },
  // ...
}
```

### Usage in Shared Components

```tsx
// In app entry
import { PlatformProvider } from "@ace-ielts/core"
import { webPlatformContext } from "./adapters"

function App() {
  return (
    <PlatformProvider context={webPlatformContext}>
      <Dashboard />
    </PlatformProvider>
  )
}

// In shared components
import { usePlatform, useStorage } from "@ace-ielts/core"

function MyComponent() {
  const { platform } = usePlatform()
  const storage = useStorage()
  // Works on all platforms!
}
```

---

## Tauri Desktop Rules

- Use `@tauri-apps/api` for native OS features
- Use `@tauri-apps/plugin-*` for official plugins
- **NEVER** use Node.js APIs directly - Tauri runs in browser context

### Common Tauri APIs
```typescript
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs"
import { open, save } from "@tauri-apps/plugin-dialog"
import { open as openUrl } from "@tauri-apps/plugin-shell"
import { Store } from "@tauri-apps/plugin-store"
```

---

## Package Manager

**pnpm only** (>=8.0.0, Node.js >=18.0.0)

```bash
# Install all dependencies
pnpm install

# Add to specific package
pnpm --filter @ace-ielts/ui add <package>
pnpm --filter @ace-ielts/core add -D <package>

# Add to root (shared dev tools)
pnpm add -D -w <package>

# Run in specific package
pnpm --filter @ace-ielts/web <command>
```

---

## Scripts

```bash
# Development
pnpm dev:web              # Web dev server
pnpm dev:desktop          # Desktop dev (Tauri)

# Build
pnpm build:web            # Build web
pnpm build:desktop        # Build desktop
pnpm build:all            # Build all

# Quality
pnpm lint                 # Lint all
pnpm typecheck            # Type-check all

# Desktop
pnpm package:desktop      # Package for distribution
```

---

## TypeScript Configuration

All packages extend `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "paths": {
      "@ace-ielts/core": ["packages/core/src"],
      "@ace-ielts/core/*": ["packages/core/src/*"],
      "@ace-ielts/ui": ["packages/ui/src"],
      "@ace-ielts/ui/*": ["packages/ui/src/*"]
    }
  }
}
```

---

## Rules Summary

### ✅ DO
- Keep shared code platform-agnostic in `packages/`
- Use adapter pattern for platform-specific APIs
- Export through barrel files (`index.ts`)
- Use `workspace:*` for internal dependencies
- Run `pnpm typecheck` before committing

### ❌ DON'T
- Import from `app/*` in `packages/*`
- Use `localStorage` directly in shared packages
- Use Node.js APIs in Tauri frontend
- Create circular dependencies
- Duplicate code between web and desktop
