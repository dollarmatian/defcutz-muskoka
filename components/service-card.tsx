import { Button } from "@/components/ui/button"
import Link from "next/link"

type ServiceProps = {
    name: string
    price?: number
    description: string
    image?: string
  }
export function ServiceCard({ service }: { service: ServiceProps }) {
return ( <div
                
                className="group relative overflow-hidden rounded-lg border p-6 hover:shadow-lg transition-all"
              >
                <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-theme-gold to-theme-darkGold"></div>
              { service.image 
              ? (<img
                src={service.image}
                alt={service.description}
                className="object-center h-36 w-auto w-full flex items-center justify-center"
              />) 
              : (<>
                <h3 className="text-xl font-bold mb-2">{service.name}</h3>
                <p className="text-gray-600 mb-4">{service.description}</p>
                <div className={`flex items-center ${service.price ? 'justify-between' :'justify-end'}`}>
                  {service.price && <span className="text-lg font-bold">${service.price}</span>}
                  <Link  href="/booking">
                  <Button
                    variant="outline"
                    className="border-theme-gold text-theme-gold group-hover:bg-theme-gold group-hover:text-black transition-colors"
                  >
                    <span className="z-10">Book Now</span>
                    <span className="hidden group-hover:block absolute inset-0 shimmer"></span>
                  </Button>
                  </Link>
                </div></>) }  
              </div>)}