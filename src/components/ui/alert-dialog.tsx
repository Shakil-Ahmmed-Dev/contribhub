import * as React from 'react'
import { AlertDialog as RadixAlertDialog } from 'radix-ui'
import { cn } from '#/lib/utils'
import { buttonVariants } from './button'

export const AlertDialog = RadixAlertDialog.Root
export const AlertDialogTrigger = RadixAlertDialog.Trigger

export function AlertDialogContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixAlertDialog.Content>) {
  return (
    <RadixAlertDialog.Portal>
      <RadixAlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]" />
      <RadixAlertDialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-xl',
          className,
        )}
        {...props}
      />
    </RadixAlertDialog.Portal>
  )
}

export function AlertDialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5', className)} {...props} />
}

export function AlertDialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixAlertDialog.Title>) {
  return (
    <RadixAlertDialog.Title
      className={cn('text-base font-semibold', className)}
      {...props}
    />
  )
}

export function AlertDialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixAlertDialog.Description>) {
  return (
    <RadixAlertDialog.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export function AlertDialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end gap-2', className)}
      {...props}
    />
  )
}

export function AlertDialogAction({
  className,
  variant = 'destructive',
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixAlertDialog.Action> & {
  variant?: 'default' | 'destructive'
}) {
  return (
    <RadixAlertDialog.Action
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  )
}

export function AlertDialogCancel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixAlertDialog.Cancel>) {
  return (
    <RadixAlertDialog.Cancel
      className={cn(buttonVariants({ variant: 'outline' }), className)}
      {...props}
    />
  )
}
