import { ServiceCard } from "@/components/service-card"

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
    {name:"Bearded Man",description: "Image of a bearded freshly trimmed man", image:"/images/man-hairstyles.jpg"},
    {name:"We Do Not Offer",description: "Washing, Colouring, or Straight-Razor Services"}
  ]
export function ServicesSection(){

return (   
       <section id="services" className="py-16 bg-white">
        
    <div className="container">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold tracking-tight">Our Services</h2>
        <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
          Premium cuts and grooming services for all nationalities with authentic Urban vibes
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {services.map((service, index) => (
          <ServiceCard key={index} service={service} />
        ))}
      </div>
    </div>
        
  </section>)
  }