import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import { ThemeProvider } from 'next-themes';
import { NavLink } from '@/components/nav-link';
import { ThemeToggle } from '@/components/theme-toggle';
import { Toaster } from '@/components/ui/sonner';
import { RunSecretProvider } from '@/lib/client-secret';
import { RUN_SECRET_STORAGE_KEY } from '@/lib/run-secret-key';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
});

export const metadata: Metadata = {
  title: 'Next Prospect',
  description:
    'Turns public company evidence into ranked, product-specific Vercel opportunities and grounded outreach for human review.'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-dvh overflow-x-clip font-sans antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem(${JSON.stringify(RUN_SECRET_STORAGE_KEY)}))document.documentElement.dataset.secret='stored'}catch(e){}`
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-background focus:px-4 focus:py-2"
          >
            Skip to content
          </a>
          <header className="sticky top-0 z-20 border-b border-border bg-background pt-[env(safe-area-inset-top)]">
            <div className="mx-auto flex min-h-14 max-w-7xl items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4 [@media(max-height:700px)]:min-h-12 [@media(max-height:700px)]:py-2">
              <Link href="/" className="flex min-w-0 items-center gap-2 font-medium sm:gap-4">
                <svg viewBox="0 0 76 65" className="size-4 shrink-0" aria-hidden>
                  <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="currentColor" />
                </svg>
                <span className="text-muted-foreground hidden font-normal sm:inline">/</span>
                <span className="truncate">Next Prospect</span>
              </Link>
              <nav className="flex items-center gap-1 text-sm sm:gap-4" aria-label="Primary">
                <NavLink href="/">Prospects</NavLink>
                <NavLink href="/about">About</NavLink>
              </nav>
              <div className="ml-auto shrink-0">
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main
            id="main"
            className="mx-auto w-full min-w-0 max-w-7xl px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8 [@media(max-height:700px)]:py-4"
          >
            <RunSecretProvider>{children}</RunSecretProvider>
          </main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
