"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

type PhotoEntry = {
  url: string
  photoReference?: string
  fetchedAt?: string
}

// Static fallback images
const staticImages = [
  "/images/gallery/star_pattern.jpg",
  "/images/gallery/fade_pattern.png",
]

// Hook to detect screen size
function useScreenSize() {
  const [screenSize, setScreenSize] = useState('lg')

  useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth < 768) {
        setScreenSize('sm') // Mobile: 1 photo
      } else if (window.innerWidth < 1024) {
        setScreenSize('md') // Tablet: 2 photos
      } else {
        setScreenSize('lg') // Desktop: 3 photos
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  return screenSize
}

export function GalleryCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [photos, setPhotos] = useState<string[]>(staticImages)
  const screenSize = useScreenSize()

  // Fetch dynamic photos from S3-hosted JSON
  useEffect(() => {
    fetch("/data/photos.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        const entries: PhotoEntry[] = data.photos ?? []
        if (entries.length > 0) {
          const urls = entries.map((p) => p.url).filter(Boolean)
          if (urls.length > 0) {
            // Combine: Google photos first, then static gallery photos (no duplicates)
            const staticSet = new Set(staticImages)
            const googleOnly = urls.filter((u) => !staticSet.has(u))
            setPhotos([...googleOnly, ...staticImages])
          }
        }
      })
      .catch(() => {
        // Silently fall back to static images (already set as initial state)
      })
  }, [])

  // Get number of photos to show based on screen size
  const getPhotosPerView = () => {
    switch(screenSize) {
      case 'sm': return 1
      case 'md': return 2
      case 'lg': return 3
      default: return 3
    }
  }

  const photosPerView = getPhotosPerView()

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) =>
        prevIndex >= photos.length - photosPerView ? 0 : prevIndex + 1
      )
    }, 4000) // Change every 4 seconds

    return () => clearInterval(interval)
  }, [photos.length, photosPerView])

  const goToPrevious = () => {
    setCurrentIndex(prevIndex =>
      prevIndex <= 0 ? photos.length - photosPerView : prevIndex - 1
    )
  }

  const goToNext = () => {
    setCurrentIndex(prevIndex =>
      prevIndex >= photos.length - photosPerView ? 0 : prevIndex + 1
    )
  }

  if (photos.length === 0) return null

  return (
    <div className="relative overflow-hidden">
      <div
        className="flex transition-transform duration-700 ease-in-out"
        style={{
          transform: `translateX(-${(currentIndex * 100) / photosPerView}%)`,
        }}
      >
        {photos.map((photoUrl, index) => (
          <div
            key={index}
            className="w-full md:w-1/2 lg:w-1/3 flex-shrink-0 px-2"
          >
            <div className="aspect-square overflow-hidden rounded-lg">
              <img
                src={photoUrl}
                alt={`Haircut photo ${index + 1}`}
                className="h-full w-full object-cover transition-transform hover:scale-105"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center mt-8 space-x-8">
        {/* Previous button */}
        <button
          onClick={goToPrevious}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 hover:bg-theme-gold hover:text-black transition-colors"
          aria-label="Previous photos"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Dots indicator */}
        <div className="flex space-x-2">
          {Array.from({ length: Math.ceil(photos.length / photosPerView) }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index * photosPerView)}
              className={`w-3 h-3 rounded-full transition-colors ${
                Math.floor(currentIndex / photosPerView) === index ? 'bg-theme-gold' : 'bg-gray-300'
              }`}
              aria-label={`Go to photo group ${index + 1}`}
            />
          ))}
        </div>

        {/* Next button */}
        <button
          onClick={goToNext}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 hover:bg-theme-gold hover:text-black transition-colors"
          aria-label="Next photos"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="text-center mt-4 text-sm text-gray-600">
        {(() => {
          const start = currentIndex + 1
          const end = Math.min(currentIndex + photosPerView, photos.length)
          const range = start === end ? `${start}` : `${start}-${end}`
          return `Showing ${range} of ${photos.length} photos`
        })()}
      </div>
    </div>
  )
}
