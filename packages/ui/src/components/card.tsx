import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@ace-ielts/core"

/**
 * Card component variants
 * AI-Enhanced Design System - Sage Theme
 */
const cardVariants = cva(
  [
    "rounded-md bg-neutral-card",
    "transition-all duration-200"
  ],
  {
    variants: {
      variant: {
        default: [
          "p-lg shadow-card",
          "border border-neutral-border/50",
          "hover:shadow-card-hover"
        ],
        flat: [
          "p-lg",
          "border border-neutral-border"
        ],
        elevated: [
          "p-lg shadow-lg",
          "hover:shadow-xl"
        ],
        glass: [
          "p-lg",
          "bg-white/80 backdrop-blur-md",
          "border border-white/50",
          "shadow-lg"
        ],
        ai: [
          "p-lg shadow-card",
          "border border-ai-200/50",
          "relative overflow-hidden",
          "hover:shadow-glow-ai hover:border-ai-300/50"
        ],
        interactive: [
          "p-lg shadow-card",
          "border border-neutral-border/50",
          "hover:shadow-card-hover hover:border-primary/30",
          "cursor-pointer"
        ],
        outline: [
          "p-lg",
          "border-2 border-dashed border-neutral-border",
          "hover:border-primary/50 hover:bg-primary-50/30"
        ]
      },
      padding: {
        none: "p-0",
        sm: "p-md",
        default: "p-lg",
        lg: "p-xl"
      }
    },
    defaultVariants: {
      variant: "default",
      padding: "default"
    }
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

/**
 * Card container component with AI-enhanced variants
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, children, ...props }, ref) => {
    // Handle AI variant's special gradient overlay
    if (variant === "ai") {
      return (
        <div
          ref={ref}
          className={cn(cardVariants({ variant, padding }), className)}
          {...props}
        >
          <div 
            className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{
              background: "linear-gradient(135deg, rgba(139, 92, 246, 0.03) 0%, rgba(13, 148, 136, 0.03) 100%)"
            }}
          />
          <div className="relative">{children}</div>
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant, padding }), className)}
        {...props}
      />
    )
  }
)
Card.displayName = "Card"

/**
 * Card header section for titles and descriptions
 */
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

/**
 * Card title typography - h2 style from design system
 */
const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-h3 font-semibold text-text-primary tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

/**
 * Card description text - body style with secondary color
 */
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-body text-text-secondary", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

/**
 * Card content area
 */
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

/**
 * Card footer for actions
 */
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-md", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants }
