import { errorResponse } from "./cors.ts"
import { createLogger } from "./logger.ts"

type Handler = (req: Request, params: Record<string, string>) => Promise<Response> | Response

export class Router {
  private routes: { method: string; pattern: URLPattern; handler: Handler }[] = []
  private logger = createLogger("Router")

  add(method: string, pathname: string, handler: Handler) {
    this.routes.push({
      method,
      pattern: new URLPattern({ pathname }),
      handler,
    })
  }

  get(pathname: string, handler: Handler) {
    this.add("GET", pathname, handler)
  }

  post(pathname: string, handler: Handler) {
    this.add("POST", pathname, handler)
  }

  put(pathname: string, handler: Handler) {
    this.add("PUT", pathname, handler)
  }

  patch(pathname: string, handler: Handler) {
    this.add("PATCH", pathname, handler)
  }

  delete(pathname: string, handler: Handler) {
    this.add("DELETE", pathname, handler)
  }

  /**
   * Handle incoming request and route to appropriate handler
   */
  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url)
    let path = url.pathname

    // Supabase edge function URL format: /<function-name>/<subpath>
    // we extract the <subpath> part for routing
    const parts = path.split("/")
    if (parts.length >= 2) {
      const subpath = parts.slice(2).join("/")
      path = subpath ? "/" + subpath : "/"
    }

    // Match against registered routes
    for (const route of this.routes) {
      if (req.method !== route.method) continue

      const match = route.pattern.exec({ pathname: path })
      if (match) {
        const params = (match.pathname.groups || {}) as Record<string, string>
        try {
          return await route.handler(req, params)
        } catch (error) {
          this.logger.error("Handler error", { path, method: req.method }, error as Error)
          throw error
        }
      }
    }

    this.logger.warn("Route not found", { method: req.method, path })
    return errorResponse("Not Found", 404)
  }
}