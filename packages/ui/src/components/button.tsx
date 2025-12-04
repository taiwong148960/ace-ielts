import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@ace-ielts/core"

/**
 * Button component variants using class-variance-authority
 * AI-Enhanced Design System - Sage Theme
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "text-sm font-semibold",
    "rounded-md",
    "ring-offset-white",
    "transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.98]"
  ],
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-white",
          "hover:bg-primary-hover hover:shadow-glow-primary"
        ],
        secondary: [
          "bg-neutral-card text-text-primary",
          "border border-neutral-border",
          "hover:bg-neutral-hover hover:border-neutral-border"
        ],
        outline: [
          "border border-neutral-border bg-transparent",
          "text-text-primary",
          "hover:bg-neutral-hover hover:border-primary hover:text-primary"
        ],
        ghost: [
          "text-text-secondary",
          "hover:bg-primary-50 hover:text-primary"
        ],
        link: [
          "text-primary underline-offset-4",
          "hover:underline"
        ],
        // AI-specific variants
        ai: [
          "text-white",
          "bg-gradient-to-r from-primary to-ai",
          "hover:from-primary-hover hover:to-ai-dark",
          "hover:shadow-glow-ai"
        ],
        "ai-outline": [
          "bg-transparent text-ai",
          "border border-ai-300",
          "hover:bg-ai-50 hover:border-ai-400"
        ],
        "ai-ghost": [
          "text-ai",
          "hover:bg-ai-50"
        ],
        destructive: [
          "bg-functional-error text-white",
          "hover:bg-red-600"
        ],
        success: [
          "bg-functional-success text-white",
          "hover:bg-emerald-600"
        ]
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        xl: "h-14 px-10 text-lg",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-12 w-12"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

/**
 * Primary button component with AI-enhanced variants
 * Supports polymorphism through asChild prop
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
