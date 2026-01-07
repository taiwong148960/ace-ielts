---
trigger: always_on
---

# Architecture & Data Flow

## Three-Layer Architecture

**Strict separation required.** Never make Supabase calls directly in UI components.

```
┌─────────────────────────────────────────────────────────┐
│  Layer 3: UI Components                                 │
│  - Consume hooks, render UI                             │
│  - Handle isLoading, isError, data states               │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Custom Hooks (packages/core/src/hooks/)       │
│  - Wrap services with useQuery/useMutation              │
│  - Manage queryKey, staleTime, optimistic updates       │
├─────────────────────────────────────────────────────────┤
│  Layer 1: API Services (packages/core/src/services/)    │
│  - Call Edge Functions or direct Supabase               │
│  - Pure functions, no React hooks                       │
└─────────────────────────────────────────────────────────┘
```

### Layer 1: API Services

**Location:** `packages/core/src/services/`

**Primary pattern:** Call Supabase Edge Functions
```typescript
export async function createBook(data: CreateBookInput): Promise<Book> {
  const supabase = getSupabase()
  const { data: result, error } = await supabase.functions.invoke("vocabulary-create-book", {
    body: data,
  })
  if (error) throw new Error(`Failed to create book: ${error.message}`)
  return result
}
```

**Direct Supabase access (exceptions only):**
- Authentication operations (sign in, sign out, session)
- Simple reads protected by RLS
- Real-time subscriptions

```typescript
// ✅ Allowed: Simple RLS-protected read
export async function getBooks(userId: string): Promise<Book[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("vocabulary_books")
    .select("*")
    .eq("user_id", userId)
  if (error) throw error
  return data
}
```

### Layer 2: Custom Hooks

**Location:** `packages/core/src/hooks/`

```typescript
// Query key factory
export const vocabularyKeys = {
  all: ["vocabulary"] as const,
  books: () => [...vocabularyKeys.all, "books"] as const,
  book: (id: string) => [...vocabularyKeys.books(), id] as const,
}

// Hook implementation
export function useBooks() {
  return useQuery({
    queryKey: vocabularyKeys.books(),
    queryFn: getBooks,
    staleTime: 5 * 60 * 1000,  // 5 minutes
    gcTime: 10 * 60 * 1000,    // 10 minutes
  })
}
```

### Layer 3: UI Components

```typescript
// ✅ Good: Use hook
function BookList() {
  const { data, isLoading, isError } = useBooks()
  if (isLoading) return <Skeleton />
  if (isError) return <ErrorAlert />
  return <List data={data} />
}

// ❌ Bad: Direct Supabase in component
function BookList() {
  const [books, setBooks] = useState([])
  useEffect(() => {
    supabase.from("books").select("*").then(...)  // NEVER do this
  }, [])
}
```

---

## Edge Functions

**Location:** `supabase/functions/<function-name>/index.ts`

### Naming Convention
Use kebab-case: `vocabulary-create-book`, `word-enrich-details`, `gemini-enrich-word`

### Response Format
```typescript
// Success
return new Response(JSON.stringify({ success: true, data: result }), {
  headers: { "Content-Type": "application/json" },
})

// Error
return new Response(JSON.stringify({ 
  success: false, 
  error: error.message,
  code: error.code || "UNKNOWN_ERROR",
}), {
  status: error.status || 400,
  headers: { "Content-Type": "application/json" },
})
```

### Local Development
```bash
supabase functions serve <function-name>  # Local testing
supabase functions deploy <function-name> # Production deploy
```

---

## Error Handling

### Service Layer
- Always throw errors - let React Query catch them
- Include context in error messages
- Log before re-throwing

```typescript
export async function createBook(data: CreateBookInput): Promise<Book> {
  try {
    const { data: result, error } = await supabase.functions.invoke("vocabulary-create-book", { body: data })
    if (error) throw new Error(`Failed to create book: ${error.message}`)
    if (!result) throw new Error("No data returned from create book function")
    return result
  } catch (error) {
    logger.error("Book creation failed", { userId: data.userId }, error as Error)
    throw error
  }
}
```

### UI Layer
- Use `isError` and `error` from React Query
- Display user-friendly messages (use i18n keys)
- Provide retry actions

```typescript
if (isError) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{t("errors.failedToLoadBooks")}</AlertDescription>
      <Button onClick={() => refetch()}>{t("common.retry")}</Button>
    </Alert>
  )
}
```

---

## Logging

Use centralized logger from `@ace-ielts/core`. **Never use raw `console.log`**.

```typescript
import { createLogger, startTimer } from "@ace-ielts/core"

const logger = createLogger("VocabularyService")
```

### Log Levels
| Level | When to Use | Production Output |
|-------|-------------|-------------------|
| `debug` | Variable values, execution flow | ❌ |
| `info` | Normal operations, state changes | ✅ |
| `warn` | Recoverable issues, retries | ✅ |
| `error` | Failures requiring attention | ✅ |

### Patterns
```typescript
// Basic logging
logger.info("Creating book", { userId, bookName })
logger.error("Operation failed", { bookId }, error)

// Performance timing
const timer = startTimer("VocabularyService", "fetchBooks")
const books = await fetchBooks()
timer.end({ bookCount: books.length })
```

### Never Log
- ❌ API keys, tokens, secrets
- ❌ Passwords or credentials
- ❌ Full request/response bodies with PII

---

## Performance Optimization

### Code Splitting
```typescript
const VocabularyBooks = lazy(() => import("@ace-ielts/ui/pages/vocabulary/VocabularyBooks"))
```

### React Query Cache
```typescript
{
  staleTime: 5 * 60 * 1000,   // 5 min before refetch
  gcTime: 10 * 60 * 1000,     // 10 min before garbage collection
}
```

### Memoization
```typescript
const sortedWords = useMemo(() => words.sort(...), [words])
const handleClick = useCallback((id) => navigate(`/words/${id}`), [navigate])
```

### Bundle Size
```typescript
// ❌ Bad
import * as Icons from "lucide-react"

// ✅ Good
import { Book, Settings } from "lucide-react"
```

---

## No Mock Data

- Use **Local Supabase** for development
- Do NOT create mock servers (MirageJS) or mock JSON files
- Use `supabase/seed.sql` for initial test data
