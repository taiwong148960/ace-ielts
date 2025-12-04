/**
 * Input Component
 * AI-Enhanced Design System - Sage Theme
 */

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@ace-ielts/core"

const inputVariants = cva(
  [
    "flex w-full rounded-md",
    "border bg-neutral-card",
    "text-sm text-text-primary",
    "ring-offset-neutral-card",
    "transition-all duration-200",
    "file:border-0 file:bg-transparent file:text-sm file:font-medium",
    "placeholder:text-text-tertiary",
    "focus-visible:outline-none",
    "disabled:cursor-not-allowed disabled:opacity-50"
  ],
  {
    variants: {
      variant: {
        default: [
          "border-neutral-border",
          "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/10"
        ],
        ai: [
          "border-neutral-border",
          "focus-visible:border-ai focus-visible:ring-2 focus-visible:ring-ai/10"
        ],
        ghost: [
          "border-transparent bg-neutral-hover",
          "focus-visible:border-primary focus-visible:bg-neutral-card"
        ],
        error: [
          "border-functional-error",
          "focus-visible:border-functional-error focus-visible:ring-2 focus-visible:ring-functional-error/10"
        ]
      },
      inputSize: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 py-1.5 text-xs",
        lg: "h-12 px-5 py-3"
      }
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default"
    }
  }
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  inputSize?: "default" | "sm" | "lg"
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, inputSize, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, inputSize, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input, inputVariants }
