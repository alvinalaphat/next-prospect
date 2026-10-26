"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--geist-background)",
          "--normal-text": "var(--geist-foreground)",
          "--normal-border": "var(--geist-border)",
          "--success-bg": "var(--geist-background)",
          "--success-text": "var(--geist-positive)",
          "--success-border": "var(--geist-positive)",
          "--info-bg": "var(--geist-background)",
          "--info-text": "var(--geist-foreground)",
          "--info-border": "var(--geist-border)",
          "--warning-bg": "var(--geist-background)",
          "--warning-text": "var(--geist-warning)",
          "--warning-border": "var(--geist-warning)",
          "--error-bg": "var(--geist-background)",
          "--error-text": "var(--geist-error)",
          "--error-border": "var(--geist-error)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
