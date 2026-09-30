import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { NavLink } from '@/components/nav-link';
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
  title: 'Outbound Agent',
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
          <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <svg viewBox="0 0 76 65" className="size-4" aria-hidden>
                  <path d="M37.5 0L75 65H0z" fill="currentColor" />
                </svg>
                <span className="text-muted-foreground font-normal">/</span>
                Outbound Agent
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                <NavLink href="/">Prospects</NavLink>
                <NavLink href="/about">About</NavLink>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
