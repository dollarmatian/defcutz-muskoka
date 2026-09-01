import Link from "next/link"
import { Clock, MapPin, Phone } from "lucide-react"
import { BusinessHours } from "@/components/business-hours"

export function Footer(){
    return (
        <>
        <div className="h-2 bg-gradient-to-r from-jamaican-green via-jamaican-yellow to-jamaican-black"></div>
        <footer id="contact" className="footer-woodgrain-bg py-12 text-white">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-theme-gold to-theme-lightGold bg-clip-text text-transparent">
                DEF CUTZ MUSKOKA
              </h3>
              <p className="text-gray-400 mb-4">Authentic Urban barber experience with premium cuts and styles.</p>
              {/* <div className="flex gap-4">
                <a href="#" className="text-theme-gold hover:text-theme-lightGold">
                  <Instagram className="h-5 w-5" />
                </a>
                <a href="#" className="text-theme-gold hover:text-theme-lightGold">
                  <Facebook className="h-5 w-5" />
                </a>
              </div> */}
            </div>
            <div>
              <h3 className="text-lg font-medium mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="#services" className="text-gray-400 hover:text-theme-gold">
                    Services
                  </Link>
                </li>
                <li>
                  <Link href="#gallery" className="text-gray-400 hover:text-theme-gold">
                    Gallery
                  </Link>
                </li>
                <li>
                  <Link href="#about" className="text-gray-400 hover:text-theme-gold">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="#booking" className="text-gray-400 hover:text-theme-gold">
                    Book Appointment
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-4">Contact Info</h3>
              <ul className="space-y-2 text-gray-400">
                <li className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-theme-gold" />
                  <span>5 Johanna St, Huntsville, Ontario P1H 1V5</span>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-theme-gold" />
                  <span>(705) 571-6341</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-theme-gold mt-0.5" />
                  <BusinessHours variant="compact" textClass="text-gray-400" />
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500">
            <p>&copy; {new Date().getFullYear()} DEF CUTZ MUSKOKA Barber Shop. All rights reserved.</p>
          </div>
        </div>
      </footer>
      </>
    )
}
