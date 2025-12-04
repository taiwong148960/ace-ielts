/**
 * Progress Component
 * AI-Enhanced Design System - Sage Theme
 * Built on Radix UI with gradient and glow effects
 */

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { motion } from "framer-motion"
import { cn } from "@ace-ielts/core"

interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** Custom indicator color or gradient */
  indicatorColor?: string
  /** Enable animation on mount */
  animated?: boolean
  /** Visual variant */
  variant?: "default" | "ai" | "skill-listening" | "skill-reading" | "skill-writing" | "skill-speaking"
  /** Size variant */
  size?: "sm" | "default" | "lg"
  /** Show glow effect */
  glow?: boolean
}

const progressColors = {
  default: "bg-gradient-to-r from-primary to-primary-500",
  ai: "bg-gradient-to-r from-primary via-ai to-ai-light",
  "skill-listening": "bg-skill-listening",
  "skill-reading": "bg-skill-reading",
  "skill-writing": "bg-skill-writing",
  "skill-speaking": "bg-skill-speaking"
}

const progressSizes = {
  sm: "h-1.5",
  default: "h-2",
  lg: "h-3"
}

/**
 * Progress bar component with AI-enhanced styling
 * Supports custom colors, gradients, and animations
 */
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ 
  className, 
  value, 
  indicatorColor, 
  animated = false, 
  variant = "default",
  size = "default",
  glow = false,
  ...props 
}, ref) => {
  const colorClass = progressColors[variant]
  const sizeClass = progressSizes[size]
  
  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative w-full overflow-hidden rounded-full",
        "bg-neutral-border/50",
        sizeClass,
        className
      )}
      {...props}
    >
      {animated ? (
        <motion.div
          className={cn(
            "h-full w-full flex-1 rounded-full",
            !indicatorColor && colorClass,
            glow && "shadow-glow-sm"
          )}
          style={{ 
            backgroundColor: indicatorColor,
            originX: 0
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: (value || 0) / 100 }}
          transition={{ 
            duration: 0.8, 
            ease: [0.16, 1, 0.3, 1], // ease-out-expo
            delay: 0.2 
          }}
        />
      ) : (
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full w-full flex-1 rounded-full",
            "transition-all duration-500 ease-out",
            !indicatorColor && colorClass,
            glow && "shadow-glow-sm"
          )}
          style={{ 
            transform: `translateX(-${100 - (value || 0)}%)`,
            backgroundColor: indicatorColor
          }}
        />
      )}
    </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
