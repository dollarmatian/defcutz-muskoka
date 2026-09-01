"use client"
import Link from "next/link"
import Image from "next/image"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import React, { useState } from "react"

export function NavBar(){
    const [open, setOpen] = useState(false)
    return (
        <header className="sticky top-0 z-40 w-full border-b header-woodgrain-bg text-white">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center space-x-2">
              <div className="flex items-center relative w-12 h-12 
               sm:block"
              //  hidden
               >
                {/* <Image
                  src="/images/logoFULL.jpg"
                  alt="DEF CUTZ MUSKOKA Logo"
                  width={148}
                  height={64}
                  className="object-contain"
                /> */}
                <Image
                  src="/images/logo.png"
                  alt="DEF CUTZ MUSKOKA Logo"
                  width={42}
                  height={42}
                  className="rounded-sm object-contain"
                />
              </div>
              <span className="text-xl md:text-2xl font-bold tracking-tight shimmer-text">
                DEF CUTZ MUSKOKA
              </span> 

            </Link>
          </div>
          <nav className="hidden md:flex gap-6">
            <Link href="#services" className="text-sm font-medium hover:text-theme-gold">
              Services
            </Link>
            <Link href="/#gallery" className="text-sm font-medium hover:text-theme-gold">
              Gallery
            </Link>
            <Link href="/#about" className="text-sm font-medium hover:text-theme-gold">
              About
            </Link>
            <Link href="#contact" className="text-sm font-medium hover:text-theme-gold">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Button
              asChild
              variant="default"
              className="hidden md:flex bg-theme-gold hover:bg-theme-darkGold text-black relative overflow-hidden"
            >
              <Link href="/booking">
                <span className="relative z-10">Book Now</span>
                <span className="absolute inset-0 shimmer"></span>
              </Link>
            </Button>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden border-theme-gold text-theme-gold">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="sidebar-woodgrain-bg text-white">
                <nav className="flex flex-col gap-4 mt-8">
                  <Link href="#services" className="text-lg font-medium hover:text-theme-gold">
                    <span onClick={() => setOpen(false)}>Services</span>
                  </Link>
                  <Link href="/#gallery" className="text-lg font-medium hover:text-theme-gold">
                    <span onClick={() => setOpen(false)}>Gallery</span>
                  </Link>
                  <Link href="/#about" className="text-lg font-medium hover:text-theme-gold">
                    <span onClick={() => setOpen(false)}>About</span>
                  </Link>
                  <Link href="#contact" className="text-lg font-medium hover:text-theme-gold">
                    <span onClick={() => setOpen(false)}>Contact</span>
                  </Link>
                  <Button asChild variant="default" className="mt-4 bg-theme-gold hover:bg-theme-darkGold text-black">
                    <div className="relative h-full w-full">
                      <Link href="/booking">
                        <span className="relative z-10" onClick={() => setOpen(false)}>Book Now</span>
                        <span className="absolute inset-0 shimmer"></span>
                      </Link>
                    </div>
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    )
}