import * as React from 'react'
import { cva  } from 'class-variance-authority'
import type {VariantProps} from 'class-variance-authority';
import { cn } from '#/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground bg-transparent',
        muted: 'border-border/60 bg-muted text-muted-foreground',
        destructive:
          'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
      },
    },
    defaultVariants: {
      variant: 'outline',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}
