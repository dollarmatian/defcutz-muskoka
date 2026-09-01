"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import staticReviewsData from "@/public/google-reviews/reviews.json"
import { isVisible, type Review } from "@/lib/reviews"

// Static fallback reviews
const staticReviews: Review[] = staticReviewsData.reviews.filter(isVisible)

// Hook to detect screen size
function useScreenSize() {
  const [screenSize, setScreenSize] = useState('lg')

  useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth < 768) {
        setScreenSize('sm') // Mobile: 1 review
      } else if (window.innerWidth < 1024) {
        setScreenSize('md') // Tablet: 2 reviews
      } else {
        setScreenSize('lg') // Desktop: 3 reviews
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  return screenSize
}

export function RotatingTestimonials() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [reviews, setReviews] = useState<Review[]>(staticReviews)
  const screenSize = useScreenSize()

  // Fetch dynamic reviews from S3-hosted JSON
  useEffect(() => {
    fetch("/data/reviews.json", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        const fetched: Review[] = (data.reviews ?? []).filter(isVisible)
        if (fetched.length > 0) {
          setReviews(fetched)
        }
      })
      .catch(() => {
        // Silently fall back to static data (already set as initial state)
      })
  }, [])

  // Get number of reviews to show based on screen size
  const getReviewsPerView = () => {
    switch(screenSize) {
      case 'sm': return 1
      case 'md': return 2
      case 'lg': return 3
      default: return 3
    }
  }

  const reviewsPerView = getReviewsPerView()

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) =>
        prevIndex >= reviews.length - reviewsPerView ? 0 : prevIndex + 1
      )
    }, 5000) // Simple 5 second interval

    return () => clearInterval(interval)
  }, [reviews.length, reviewsPerView])

  // Get current reviews to display based on screen size
  const getCurrentReviews = () => {
    const current = []
    for (let i = 0; i < reviewsPerView; i++) {
      const index = (currentIndex + i) % reviews.length
      current.push(reviews[index])
    }
    return current
  }

  const currentReviews = getCurrentReviews()

  // Google avatar URLs accept a size suffix; request a tiny 96px crop
  // (~2-4 KB) instead of whatever size the API returned.
  const getAvatarUrl = (url: string) => {
    if (!url.includes("googleusercontent.com")) return url
    return url.split("=")[0] + "=s96-c"
  }

  // Helper function to get initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2)
  }

  // Helper function to truncate name if too long
  const getTruncatedName = (name: string) => {
    return name.length > 15 ? name.slice(0, 15) + '...' : name
  }

  // Helper function to generate consistent color based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-teal-500'
    ]
    const index = name.length % colors.length
    return colors[index]
  }

  const goToPrevious = () => {
    setCurrentIndex(prevIndex =>
      prevIndex <= 0 ? reviews.length - reviewsPerView : prevIndex - 1
    )
  }

  const goToNext = () => {
    setCurrentIndex(prevIndex =>
      prevIndex >= reviews.length - reviewsPerView ? 0 : prevIndex + 1
    )
  }

  if (reviews.length === 0) return null

  return (
    <div className="relative overflow-hidden">
      <div
        className="flex transition-transform duration-700 ease-in-out"
        style={{
          transform: `translateX(-${(currentIndex * 100) / reviewsPerView}%)`,
        }}
      >
        {reviews.map((review, index) => (
          <div
            key={review.id}
            className="w-full md:w-1/2 lg:w-1/3 flex-shrink-0 px-4"
          >
            <div className="bg-white p-6 rounded-lg shadow-sm h-full">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-full overflow-hidden">
                  {review.profilePhotoUrl ? (
                    <img
                      src={getAvatarUrl(review.profilePhotoUrl)}
                      alt={review.author}
                      width={48}
                      height={48}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className={`h-full w-full ${getAvatarColor(review.author)} flex items-center justify-center text-white font-bold text-lg ${review.profilePhotoUrl ? 'hidden' : 'flex'}`}
                    style={{ display: review.profilePhotoUrl ? 'none' : 'flex' }}
                  >
                    {getInitials(review.author)}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium">{getTruncatedName(review.author)}</h4>
                  <div className="flex text-theme-gold">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ))}
                  </div>
                </div>
              </div>
              {review.text && review.text.trim() !== '' ? (
                <p className="text-gray-600 italic">
                  &ldquo;{review.text}&rdquo;
                </p>
              ) : (
                <p className="text-gray-500 italic text-center">
                  Five star rating
                </p>
              )}
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
          aria-label="Previous testimonials"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Dots indicator */}
        <div className="flex space-x-2">
          {Array.from({ length: Math.ceil(reviews.length / reviewsPerView) }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index * reviewsPerView)}
              className={`w-3 h-3 rounded-full transition-colors ${
                Math.floor(currentIndex / reviewsPerView) === index ? 'bg-theme-gold' : 'bg-gray-300'
              }`}
              aria-label={`Go to testimonial group ${index + 1}`}
            />
          ))}
        </div>

        {/* Next button */}
        <button
          onClick={goToNext}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 hover:bg-theme-gold hover:text-black transition-colors"
          aria-label="Next testimonials"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="text-center mt-4 text-sm text-gray-600">
        {(() => {
          const start = currentIndex + 1
          const end = Math.min(currentIndex + reviewsPerView, reviews.length)
          const range = start === end ? `${start}` : `${start}-${end}`
          return `Showing ${range} of ${reviews.length} reviews`
        })()}
      </div>

      {/* Leave a Review Button */}
      <div className="text-center mt-6">
        <a
          href="https://g.page/r/CTWa1fzfcA9kEAE/review"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-6 py-3 bg-theme-gold hover:bg-theme-darkGold text-black font-medium rounded-lg transition-colors shadow-sm hover:shadow-md relative overflow-hidden"
        >
          <span className="relative z-10 flex items-center">
            <svg
              className="w-5 h-5 mr-2"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Leave a Google Review
          </span>
          <span className="absolute inset-0 shimmer"></span>
        </a>
      </div>
    </div>
  )
}
