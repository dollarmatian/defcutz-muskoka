import Link from "next/link"
import Image from "next/image"
import { Instagram, Facebook, MapPin, Phone, Clock, Menu, Award, Camera } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { ServicesSection } from "./ServicesSection"
import { Footer } from "./Footer"
import { RotatingTestimonials } from "@/components/rotating-testimonials"
import { GalleryCarousel } from "@/components/gallery-carousel"
import { BusinessHours } from "@/components/business-hours"

// Define services data here to generate schema dynamically
const servicesData = [
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
];

export default function Home() {

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Service Schema Markup for each service */}
      {servicesData.map((service, index) => (
        <script key={`service-schema-${index}`} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "http://schema.org",
          "@type": "Service",
          "serviceType": service.name,
          "provider": {
            "@type": "LocalBusiness",
            "name": "DEF CUTZ MUSKOKA Barber Shop"
          },
          "name": service.name,
          "description": service.description,
          "offers": {
            "@type": "Offer",
            "priceSpecification": {
              "@type": "UnitPriceSpecification",
              "price": service.price.toFixed(2),
              "priceCurrency": "CAD"
            }
          }
        }) }} />
      ))}

      {/* Hero Section - Updated with barber shop image and reduced overlay opacity */}
      <section className="relative">
        <div className="absolute inset-0 bg-black/75 z-10"></div> {/* Reduced opacity from 70% to 50% */}
        <div
          className="h-[70vh] bg-cover bg-center"
          style={{ backgroundImage: "url('/images/gallery/barber_shop.png')" }}
        >
          <div className="container relative z-20 flex flex-col items-center justify-center h-full text-center text-white">
            <div className="max-w-3xl space-y-10  ">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
                Authentic Urban Barber Experience
              </h1>
              <p className="text-lg text-gray-200 md:text-xl">
                Where tradition meets style. Premium cuts, fades, and grooming for kings and queens.
              </p>
              <div className="flex flex-col items-center gap-6 pt-4">
                <div className="flex flex-col sm:flex-row gap-12 justify-center">
                  <Button asChild size="lg" className="bg-theme-gold hover:bg-theme-darkGold text-black relative overflow-hidden">
                    <Link href="/booking">
                      <span className="relative z-10">Book Your Appointment</span>
                      <span className="absolute inset-0 shimmer"></span>
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="border-theme-gold text-theme-gold hover:bg-theme-gold/75"
                  >
                    <Link href="#services">View Services</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="h-4 bg-gradient-to-r from-jamaican-green via-jamaican-yellow to-jamaican-black"></div>
      </section>

      {/* Info Bar */}
      <section className="py-6 footer-woodgrain-bg  text-white">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <MapPin className="h-6 w-6 text-theme-gold" />
              <div>
                <h3 className="font-medium">Location</h3>
                <p className="text-sm text-gray-300">5 Johanna St, Huntsville, Ontario P1H 1V5</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-theme-gold" />
              <div>
                <h3 className="font-medium">Opening Hours</h3>
                <BusinessHours variant="compact" textClass="text-sm text-gray-300" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-6 w-6 text-theme-gold" />
              <div>
                <h3 className="font-medium">Contact</h3>
                <p className="text-sm text-gray-300">(705) 571-6341</p>
              </div>
            </div>
          </div>
        </div>
        
      </section>

      {/* Services Section */}
<ServicesSection />
      <div className="h-1 bg-gradient-to-r from-jamaican-green via-jamaican-yellow to-jamaican-black"></div>

      {/* About Section - Restructured with award image to the right of Patrick's image */}
      <section id="about" className="py-16 bg-white">
        <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight">Our Story</h2>
              <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
                Founded in 2020, DEF CUTZ MUSKOKA brings authentic Urban barber traditions to the heart of the city.  We are a black owned business and proudly open to all humans - regardless of race colour, disability, or sexual orientation (at the moment our location is not wheelchair accessible).
              </p>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Left side - Patrick's photo (smaller) */}
            <div className="relative md:col-span-5 order-1a md:order-2">
              <div className="absolute -top-4 -left-4 w-24 h-24 bg-gradient-to-r from-theme-gold to-theme-lightGold rounded-lg opacity-50"></div>
              <div className="flex justify-center">
                <img
                  src="/images/patrick_profile.png"
                  alt="Patrick, Founder of DEF CUTZ MUSKOKA"
                  className="rounded-lg w-4/5 h-auto border-4 border-theme-gold shadow-lg relative z-10"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-gradient-to-r from-theme-darkGold to-theme-gold rounded-lg opacity-50"></div>
            </div>

            {/* Right side - Award image at top, then text content */}
            <div className="md:col-span-7 order-2 md:order-1">
              <div className="flex justify-center md:justify-start md:ml-12 mb-8">
                <img
                  src="/images/readers_choice_award.png"
                  alt="Readers' Choice 2024 Diamond Winner - Best Barber Shop"
                  className="w-64 h-auto"
                />
              </div>

              <div className="flex  ml-4 items-center gap-2 mb-4">
                <h3 className="text-2xl font-semibold">Meet Patrick</h3>
                <div className="flex items-center text-theme-gold">
                  <Award className="h-5 w-5" />
                  <span className="text-sm font-medium ml-1">Award-Winning Barber</span>
                </div>
              </div>

              <p className="text-gray-600 mb-4">
                Founder & Master Barber with over 30 years of experience bringing authentic Urban style to every cut while catering to all nationalities, specializing in fades and multi-cultural hair and textures.
              </p>

              <p className="text-gray-600 mb-6">
                As a master barber, Patrick combines old-school techniques with modern styles to give you the perfect cut. We
                pride ourselves on creating a welcoming atmosphere where everyone feels like family.
              </p>

              <p className="text-gray-600 mb-6">
                Patrick's dedication to quality and customer service in the Huntsville area has earned DEF CUTZ MUSKOKA the prestigious Diamond
                Winner award for Best Barber Shop in The Muskokan Readers' Choice 2024.
              </p>

              {/* <div className="flex gap-4">
                <Button
                  variant="outline"
                  className="rounded-full border-theme-gold text-theme-gold hover:bg-theme-gold hover:text-black"
                >
                  <Instagram className="mr-2 h-4 w-4" />
                  Instagram
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full border-theme-gold text-theme-gold hover:bg-theme-gold hover:text-black"
                >
                  <Facebook className="mr-2 h-4 w-4" />
                  Facebook
                </Button>
              </div> */}
            </div>
          </div>
        </div>
        
      </section>
      <div className="h-1 bg-gradient-to-r from-jamaican-green via-jamaican-yellow to-jamaican-black"></div>
            {/* Gallery Section - Updated star_pattern image */}
            <section id="gallery" className="py-16 bg-stone-100">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Our Gallery</h2>
            <p className="mt-4 text-gray-600 max-w-2xl mx-auto">Check out our latest styles and cuts</p>
          </div>
          <GalleryCarousel />
          
          {/* Share Your Haircut Button */}
          <div className="text-center mt-8">
            <a
              href="https://www.google.com/maps/place/Def+Cutz+Muskoka/@45.3189027,-79.2284359,17z/data=!4m6!3m5!1s0x4d2a735a648b9cd5:0x640f70dffcd59a35!8m2!3d45.3189027!4d-79.2284359!16s%2Fg%2F11jdmzrg0r?entry=ttu&g_ep=EgoyMDI1MDYxMS4wIKXMDSoASAFQAw%3D%3D"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 bg-theme-gold hover:bg-theme-darkGold text-black font-medium rounded-lg transition-colors shadow-sm hover:shadow-md relative overflow-hidden"
            >
              <span className="relative z-10 flex items-center">
                <Camera className="w-5 h-5 mr-2" />
                Share Your Haircut Photo
              </span>
              <span className="absolute inset-0 shimmer"></span>
            </a>
          </div>
        </div>
        
      </section>
      <div className="h-1 bg-gradient-to-r from-jamaican-green via-jamaican-yellow to-jamaican-black"></div>
      {/* Testimonials */}
      <section className="py-16 bg-stone-100">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">What Our Clients Say</h2>
            <p className="mt-4 text-gray-600 max-w-2xl mx-auto">Real Google reviews from our satisfied customers</p>
          </div>
          <RotatingTestimonials />
        </div>
        
      </section>
      {/* <div className="h-1 bg-gradient-to-r from-jamaican-green via-jamaican-yellow to-jamaican-black"></div> */}
{/* <div className="h-1 bg-gradient-to-r from-jamaican-green via-jamaican-yellow to-jamaican-black"></div> */}
      {/* Booking Section - Updated grid layout (2/3 calendar, 1/3 info) */}
      <section id="booking" className="py-16 header-woodgrain-bg  text-white">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left side - Contact info and map (1/3 width) */}
            <div className="lg:col-span-1">
              <h2 className="text-3xl font-bold tracking-tight mb-6">Book Your Appointment</h2>
              <p className="mb-8">
                Reserve your spot for a premium barber experience. Choose your date and time using our online booking
                system.
              </p>
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-theme-gold" />
                  <span>(705) 571-6341</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-theme-gold" />
                  <span>5 Johanna St, Huntsville, Ontario P1H 1V5</span>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-theme-gold mt-0.5" />
                  <BusinessHours variant="full" textClass="text-white" />
                </div>

              </div>

              {/* Google Maps Embed */}
              <div className="mt-8 pt-8 border-t border-gray-800">
                <h3 className="text-xl font-bold mb-4">Directions</h3>
                <div className="rounded-lg overflow-hidden">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2818.1968446747!2d-79.2187873!3d45.0551825!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4d2a7a2c7c7f9c9d%3A0x5c5c5c5c5c5c5c5c!2s5%20Johanna%20St%2C%20Huntsville%2C%20ON%20P1H%201V5%2C%20Canada!5e0!3m2!1sen!2sus!4v1621234567890!5m2!1sen!2sus"
                    width="100%"
                    height="250"
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

            {/* Right side - Calendar (2/3 width) */}
            <div className="lg:col-span-2 bg-white rounded-lg overflow-hidden">
              <iframe
                src="https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ0NddtdUxnFztVx-LKSApYl2cahein6saivY9qD-DbRz0aIn3Pfc5MRF2vrRTtyDHpJ6NpNk2an"
                width="100%"
                height="600"
                frameBorder="0"
                title="Book an appointment"
                className="w-full"
              ></iframe>
            </div>
          </div>
        </div>
        
      </section>
      

    </div>
  )
}




