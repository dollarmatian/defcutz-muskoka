import Link from "next/link"
import { ArrowLeft, Clock, MapPin, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ServicesSection } from "../ServicesSection"
import { BusinessHours } from "@/components/business-hours"
import type { Metadata } from "next" // Import Metadata type

// Page-specific metadata for the booking page
export const metadata: Metadata = {
  title: "Book Your Barber Appointment | Def Cutz Muskoka | Huntsville, ON",
  description: "Schedule your next haircut, fade, or beard trim at Def Cutz Muskoka. Easy online booking for premium barber services in Huntsville, Ontario.",
}
export default function BookingPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header with back button */}
      <div className="footer-woodgrain-bg text-white py-4">
        <div className="container">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="text-white hover:text-theme-gold hover:bg-white/10 p-0">
              <Link href="/" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Hero Banner */}
      <section className="relative">
        <div className="absolute inset-0 bg-black/70 z-10"></div>
        <div
          className="h-[30vh] bg-cover"
          style={{ 
            backgroundImage: "url('/images/gallery/barber_shop.png?height=600&width=1600')",
            backgroundPosition: "center 75%"
          }}
        >
          <div className="container relative z-20 flex flex-col items-center justify-center h-full text-center text-white">
            <div className="max-w-3xl space-y-12">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">Book Your Appointment</h1>
              <p className="text-lg text-gray-200">Schedule your next premium barber experience</p>
            </div>
          </div>
        </div>
        <div className="h-4 bg-gradient-to-r from-jamaican-green via-jamaican-yellow to-jamaican-black"></div>
      </section>

      {/* Booking Section */}
      <section className="py-16">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-1">
              <div className="footer-woodgrain-bg text-white p-8 rounded-lg h-full">
                <h2 className="text-2xl font-bold mb-6">Contact Information</h2>
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-theme-gold" />
                    <div>
                      <h3 className="font-medium">Phone</h3>
                      <p className="text-gray-300">(705) 571-6341</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-theme-gold" />
                    <div>
                      <h3 className="font-medium">Location</h3>
                      <p className="text-gray-300">5 Johanna St, Huntsville, Ontario P1H 1V5</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-theme-gold mt-0.5" />
                    <div>
                      <h3 className="font-medium">Hours</h3>
                      <BusinessHours variant="full" textClass="text-gray-300" />
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-gray-800">
                  <h3 className="text-xl font-bold mb-4">Booking Instructions</h3>
                  <ol className="list-decimal list-inside space-y-2 text-gray-300">
                    <li>Choose an available date and time</li>
                    <li>Fill in your contact information</li>
                    <li>Confirm your appointment</li>
                  </ol>
                </div>

                {/* Google Maps Embed */}
                <div className="mt-8 pt-8 border-t border-gray-800">
                  <h3 className="text-xl font-bold mb-4">Directions</h3>
                  <div className="rounded-lg overflow-hidden">
                    <iframe
                      src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2818.1968446747!2d-79.2187873!3d45.0551825!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4d2a7a2c7c7f9c9d%3A0x5c5c5c5c5c5c5c5c!2s5%20Johanna%20St%2C%20Huntsville%2C%20ON%20P1H%201V5%2C%20Canada!5e0!3m2!1sen!2sus!4v1621234567890!5m2!1sen!2sus"
                      width="100%"
                      height="200"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="Google Maps Directions"
                      className="rounded"
                    ></iframe>
                  </div>
                  <div className="mt-4">
                    <Button
                      asChild
                      variant="outline"
                      className="w-full border-theme-gold text-theme-gold hover:bg-theme-gold hover:text-black"
                    >
                      <a
                        href="https://www.google.com/maps/dir/?api=1&destination=5+Johanna+St,+Huntsville,+ON+P1H+1V5,+Canada"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Get Directions
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-lg overflow-hidden shadow-md">
              <iframe
                src="https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ0NddtdUxnFztVx-LKSApYl2cahein6saivY9qD-DbRz0aIn3Pfc5MRF2vrRTtyDHpJ6NpNk2an"
                width="100%"
                height="700"
                frameBorder="0"
                title="Book an appointment"
                className="w-full"
              ></iframe>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <ServicesSection />


    </div>
  )
}

// Sample data - updated with new prices and removed services
const services = [
  {
    name: "Classic Cut",
    description: "Traditional haircut with precision trimming and styling.",
    price: 35,
  },
  {
    name: "Fade & Design",
    description: "Stylish fade with optional custom design or pattern.",
    price: 35,
  },
  {
    name: "Beard Trim",
    description: "Shape and style your beard for a clean, polished look.",
    price: 15,
  },
  {
    name: "Kids Cut",
    description: "Haircuts for the little ones, age 12 and under.",
    price: 25,
  },
]
