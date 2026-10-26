import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { NavLink } from '@/components/nav-link';
import { ThemeToggle } from '@/components/theme-toggle';
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
    'Finds companies running Next.js off Vercel, researches them, and drafts grounded outreach for human approval.'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-background focus:px-4 focus:py-4"
          >
            Skip to content
          </a>
          <header className="sticky top-0 z-20 border-b border-border bg-background">
            <div className="mx-auto flex min-h-16 max-w-4xl flex-wrap items-center gap-4 px-4 py-4 sm:px-6">
              <Link href="/" className="flex items-center gap-4 font-medium whitespace-nowrap">
                <svg viewBox="0 0 76 65" className="size-4" aria-hidden>
                  <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="currentColor" />
                </svg>
                <span className="text-muted-foreground font-normal">/</span>
                Next Prospect
              </Link>
              <nav className="flex items-center gap-4 text-sm" aria-label="Primary">
                <NavLink href="/">Prospects</NavLink>
                <NavLink href="/about">About</NavLink>
              </nav>
              <div className="ml-auto">
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main id="main" className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
            {children}
          </main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
