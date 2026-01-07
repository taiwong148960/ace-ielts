---
trigger: always_on
---

# Coding Standards

## Role & Context
You are an expert Full-Stack Developer building "AceIELTS" - an IELTS exam preparation application for Web and Desktop platforms.

## Tech Stack
| Category | Technology |
|----------|------------|
| Framework | Vite (React 18+) for Web, Tauri for Desktop |
| Language | TypeScript (Strict Mode) |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui (Radix UI base) |
| Icons | Lucide React |
| Animations | Framer Motion |
| Charts | Recharts |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions) |
| I18n | react-i18next |
| Data Fetching | TanStack React Query |
| AI/LLM | OpenAI-compatible API (configurable) |

## Core Principles

### 1. SOLID & Modularity
- Strictly adhere to SOLID principles
- Code must be modular to support multi-platform adaptation (Web & Desktop)

### 2. Type Safety
- **No `any`** - Define explicit interfaces for all props and data
- Use `unknown` + type guards when type is truly unknown
- All function parameters and return types must be explicitly typed

### 3. React Patterns
- Use functional components and hooks only (no class components)
- Prefer `useMemo` and `useCallback` for expensive computations and callbacks
- Use React Query for all server state management

### 4. Code Quality Workflow
After every code modification:
1. **Review related files** - Check imports, exports, type definitions, and dependent components
2. **Run validation**:
   ```bash
   pnpm typecheck  # TypeScript type safety
   pnpm lint       # ESLint rules
   ```
3. Fix all errors before considering the task complete

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `VocabularyCard.tsx` |
| Hooks | camelCase with `use` prefix | `useVocabularyBooks.ts` |
| Services | camelCase | `vocabularyService.ts` |
| Types/Interfaces | PascalCase with `I` prefix for interfaces | `IBook`, `BookProps` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Files | kebab-case for non-components | `query-keys.ts` |

## Import Order
```typescript
// 1. React and external libraries
import { useState, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"

// 2. Internal packages
import { createLogger } from "@ace-ielts/core"
import { Button } from "@ace-ielts/ui"

// 3. Relative imports
import { useBooks } from "../hooks/useBooks"
import type { Book } from "../types"
```
