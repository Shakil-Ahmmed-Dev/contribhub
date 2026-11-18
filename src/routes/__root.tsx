import { useState } from 'react'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { ThemeProvider } from '#/lib/theme'
import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('contribhub-theme');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'ContribHub — Personal Open Source Contribution Manager' },
      {
        name: 'description',
        content:
          'Collect, research, prioritize, execute, and track open-source contribution opportunities across GitHub repositories.',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
  errorComponent: RootErrorBoundary,
})

function RootComponent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Outlet />
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{
            className: 'text-sm',
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootErrorBoundary({ error }: { error: unknown }) {
  const message =
    error instanceof Error ? error.message : 'An unexpected error occurred.'
  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-background text-foreground">
      <div className="max-w-md w-full rounded-lg border border-border bg-card p-6 space-y-3">
        <h1 className="text-base font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <a
          href="/"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Return to Dashboard
        </a>
      </div>
    </div>
  )
}
