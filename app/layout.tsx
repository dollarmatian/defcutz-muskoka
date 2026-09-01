import type React from "react"
import Link from "next/link"
import Image from "next/image"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { ThemeProvider } from "@/components/theme-provider"
import {Menu } from "lucide-react"
import { Footer } from "./Footer"
import { NavBar } from "./NavBar"
import { readFileSync } from "fs"
import { join } from "path"
import { type DayHours, to24h } from "@/lib/business-hours"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Def Cutz Muskoka Barber Shop",
  description: "Def Cutz Muskoka Barber Shop in Huntsville, Ontario offers authentic urban barber experiences with premium cuts, fades, and grooming services. Book your appointment today for a fresh style.",
  icons: {
    icon: "/favicon.ico",
  }
}

// Read hours.json at render time for JSON-LD structured data
function getOpeningHoursSpec() {
  try {
    const raw = readFileSync(join(process.cwd(), "public", "data", "hours.json"), "utf-8")
    const data = JSON.parse(raw)
    const hours: DayHours[] = data.hours ?? []

    return hours
      .filter((h) => h.open && h.close)
      .map((h) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: h.day,
        opens: to24h(h.open),
        closes: to24h(h.close),
      }))
  } catch {
    // Fallback if file is missing
    return [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Thursday", "Friday", "Saturday"], opens: "09:00", closes: "21:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Wednesday", opens: "12:00", closes: "21:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Sunday", opens: "10:00", closes: "16:00" },
    ]
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const openingHoursSpec = getOpeningHoursSpec()

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* LocalBusiness Schema Markup */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "http://schema.org",
          "@type": "LocalBusiness",
          "name": "DEF CUTZ MUSKOKA Barber Shop",
          "image": "https://defcutzmuskoka.com/images/logo.png",
          "url": "https://defcutzmuskoka.com/",
          "telephone": "+17055716341",
          "priceRange": "$$",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "5 Johanna St",
            "addressLocality": "Huntsville",
            "addressRegion": "ON",
            "postalCode": "P1H 1V5",
            "addressCountry": "CA"
          },
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": "45.3189027",
            "longitude": "-79.2310108"
          },
          "openingHoursSpecification": openingHoursSpec,
        }) }} />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
                  {/* Header */}
<NavBar />
            {children}
            <Footer />
        </ThemeProvider>
      </body>
    </html>
  )
}
