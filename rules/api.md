---
trigger: glob
globs: supabase/functions/**
---
## 1. HTTP Method Semantics

Strictly follow HTTP method semantics:

| Method | Purpose | Idempotent |
|--------|---------|------------|
| `GET` | Retrieve resources | ✅ Yes |
| `POST` | Create resources | ❌ No |
| `PUT` | Replace resources entirely | ✅ Yes |
| `PATCH` | Partial update resources | ❌ No |
| `DELETE` | Delete resources | ✅ Yes |

## 2. URL Design

### 2.1 Path Conventions

```
# ✅ Good - plural nouns, kebab-case
/functions/v1/users
/functions/v1/user-profiles
/functions/v1/users/{user_id}/posts

# ❌ Bad
/functions/v1/getUsers
/functions/v1/user_profile
```

### 2.2 Supabase Edge Functions Routing

Since Edge Functions are deployed per-function, two patterns are recommended:

**Pattern A: Single Function per Resource**
```
/functions/v1/users      → supabase/functions/users/index.ts
/functions/v1/posts      → supabase/functions/posts/index.ts
```

**Pattern B: Aggregated Function with Path Routing**
```typescript
// supabase/functions/api/index.ts
import { Router } from "./router.ts"

const router = new Router()
router.get("/users", handleListUsers)
router.get("/users/:id", handleGetUser)
router.post("/users", handleCreateUser)

Deno.serve((req) => router.handle(req))
```

### 2.3 Query Parameters

```
# Pagination
?page=2&per_page=30

# Sorting
?sort=created_at&direction=desc

# Filtering
?state=active&type=admin
```

## 3. Request Conventions

### 3.1 Headers

```typescript
// Required Headers
const requiredHeaders = {
  "Content-Type": "application/json",
  "Accept": "application/json",
}

// Recommended Headers
const recommendedHeaders = {
  "X-Request-Id": "uuid-v4",  // Request tracing
}
```

### 3.2 Request Body

- `GET` / `DELETE`: Use query string, no body
- `POST` / `PUT` / `PATCH`: Use JSON body

```typescript
// ✅ Good - POST with body
const response = await fetch("/functions/v1/users", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "John", email: "john@example.com" }),
})

// ❌ Bad - POST with query string
fetch("/functions/v1/users?name=John&email=john@example.com", { method: "POST" })
```

## 4. Response Conventions

### 4.1 Status Codes

| Code | Meaning | Use Case |
|------|---------|----------|
| `200` | OK | GET/PATCH/PUT success |
| `201` | Created | POST creation success |
| `204` | No Content | DELETE success |
| `400` | Bad Request | Invalid request parameters |
| `401` | Unauthorized | Not authenticated |
| `403` | Forbidden | No permission |
| `404` | Not Found | Resource does not exist |
| `422` | Unprocessable Entity | Validation failed |
| `429` | Too Many Requests | Rate limited |
| `500` | Internal Server Error | Server error |

### 4.2 Success Response

```typescript
// Single resource
{
  "id": "123",
  "name": "John Doe",
  "email": "john@example.com",
  "created_at": "2024-01-15T08:30:00Z",
  "updated_at": "2024-01-15T08:30:00Z"
}

// List with pagination
{
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 30,
    "total": 150,
    "total_pages": 5
  }
}

// Creation success - 201 returns full resource
{
  "id": "new-uuid",
  "name": "John Doe",
  ...
}
```

### 4.3 Error Response

Following GitHub API error format:

```typescript
// Standard error response
{
  "message": "Validation Failed",
  "errors": [
    {
      "resource": "User",
      "field": "email",
      "code": "invalid",
      "message": "email format is invalid"
    }
  ]
}

// Simple error
{
  "message": "Not Found"
}
```

**Error Codes**:
- `missing` - Resource does not exist
- `invalid` - Format error
- `already_exists` - Already exists
- `unprocessable` - Cannot be processed

## 5. Edge Function Implementation Template

### 5.1 Standard Function Structure

```typescript
// supabase/functions/users/index.ts
import { createClient } from "@supabase/supabase-js"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-request-id, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const method = req.method

    // Route dispatch
    if (method === "GET" && !url.pathname.includes("/", 1)) {
      return await listUsers(req)
    }
    // ... other routes

    return jsonResponse({ message: "Not Found" }, 404)
  } catch (error) {
    console.error("Error:", error)
    return jsonResponse({ message: "Internal Server Error" }, 500)
  }
})

// Response utility
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}
```

### 5.2 Authentication Handling

```typescript
async function requireAuth(req: Request) {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Missing or invalid authorization header")
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new AuthError("Invalid token")
  }

  return { supabase, user }
}
```

### 5.3 Input Validation

```typescript
import { z } from "zod"

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(["admin", "user"]).default("user"),
})

async function handleCreateUser(req: Request) {
  const body = await req.json()
  const result = CreateUserSchema.safeParse(body)

  if (!result.success) {
    return jsonResponse({
      message: "Validation Failed",
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        code: "invalid",
        message: issue.message,
      })),
    }, 422)
  }

  // Continue with result.data
}
```

## 6. Naming Conventions

### 6.1 Field Naming

```typescript
// ✅ Good - snake_case (consistent with GitHub API)
{
  "user_id": "123",
  "created_at": "2024-01-15T08:30:00Z",
  "is_active": true
}

// ❌ Bad - camelCase
{
  "userId": "123",
  "createdAt": "2024-01-15T08:30:00Z"
}
```

### 6.2 Timestamp Format

Use ISO 8601 format with UTC timezone:

```typescript
{
  "created_at": "2024-01-15T08:30:00Z",
  "updated_at": "2024-01-15T10:45:30Z"
}
```

### 6.3 ID Format

Prefer UUID v4:

```typescript
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

## 7. Pagination

### 7.1 Offset Pagination (Simple Scenarios)

```typescript
// Request
GET /functions/v1/users?page=2&per_page=30

// Response
{
  "data": [...],
  "pagination": {
    "page": 2,
    "per_page": 30,
    "total": 150,
    "total_pages": 5
  }
}
```

### 7.2 Cursor Pagination (Large Datasets)

```typescript
// Request
GET /functions/v1/users?cursor=eyJpZCI6MTAwfQ&limit=30

// Response
{
  "data": [...],
  "next_cursor": "eyJpZCI6MTMwfQ",
  "has_more": true
}
```

## 8. Rate Limiting & Error Handling

### 8.1 Rate Limit Response

```typescript
// 429 Response Headers
{
  "Retry-After": "60",
  "X-RateLimit-Limit": "100",
  "X-RateLimit-Remaining": "0",
  "X-RateLimit-Reset": "1705312200"
}

// Body
{
  "message": "Rate limit exceeded. Please retry after 60 seconds."
}
```

### 8.2 Error Handling Best Practices

```typescript
class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public errors?: Array<{ field: string; code: string; message: string }>
  ) {
    super(message)
  }
}

function handleError(error: unknown) {
  if (error instanceof ApiError) {
    return jsonResponse(
      { message: error.message, errors: error.errors },
      error.statusCode
    )
  }

  console.error("Unexpected error:", error)
  return jsonResponse({ message: "Internal Server Error" }, 500)
}
```

## 9. Security Guidelines

1. **Always validate Authorization header**
2. **Log audit trails for sensitive operations**
3. **Never pass sensitive data in URLs**
4. **Use HTTPS (enabled by default on Supabase)**
5. **Configure appropriate CORS policies**

```typescript
// Production CORS - restrict origins
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "",
  // ...
}
```

## 10. Documentation Standards

Each Edge Function should include README or inline documentation:

```typescript
/**
 * @api {post} /functions/v1/users Create User
 * @apiName CreateUser
 * @apiGroup Users
 *
 * @apiHeader {String} Authorization Bearer token
 * @apiBody {String} name User's name
 * @apiBody {String} email User's email
 *
 * @apiSuccess (201) {Object} user Created user object
 * @apiError (422) {Object} error Validation error
 */
```
