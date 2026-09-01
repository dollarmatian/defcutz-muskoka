// Visibility rules for reviews, shared by the site and its tests.

export type Review = {
  id: string
  author: string
  profilePhotoUrl?: string
  rating: number
  text?: string
  date: string
  reply?: string
}

/**
 * One-star reviews are held back for this long before they appear.
 *
 * A review that breaches Google's policy can be reported and removed, but that
 * takes days. Showing it immediately means a single bad-faith review is the
 * first thing a visitor reads while the dispute is still open. After the window
 * passes it shows like any other review: this delays, it does not suppress.
 */
export const ONE_STAR_HOLD_DAYS = 60

export function isVisible(review: Review, now: number = Date.now()): boolean {
  if (review.rating !== 1) return true
  const posted = new Date(review.date).getTime()
  if (Number.isNaN(posted)) return true
  return (now - posted) / 86400000 >= ONE_STAR_HOLD_DAYS
}
