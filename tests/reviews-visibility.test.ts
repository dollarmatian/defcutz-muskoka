import { describe, it, expect } from "vitest"
import { isVisible, ONE_STAR_HOLD_DAYS, type Review } from "../lib/reviews"

const DAY = 86400000
const now = Date.parse("2026-09-01T00:00:00Z")
const daysAgo = (n: number) => new Date(now - n * DAY).toISOString()

const review = (over: Partial<Review> = {}): Review => ({
  id: "a1",
  author: "Sam Okafor",
  rating: 5,
  date: daysAgo(1),
  ...over,
})

describe("isVisible", () => {
  it("shows a good review immediately", () => {
    expect(isVisible(review({ rating: 5, date: daysAgo(0) }), now)).toBe(true)
  })

  it("holds a brand new one-star review", () => {
    expect(isVisible(review({ rating: 1, date: daysAgo(1) }), now)).toBe(false)
  })

  it("releases a one-star review once the window has passed", () => {
    expect(isVisible(review({ rating: 1, date: daysAgo(ONE_STAR_HOLD_DAYS + 1) }), now)).toBe(true)
  })

  it("releases exactly on the boundary day", () => {
    expect(isVisible(review({ rating: 1, date: daysAgo(ONE_STAR_HOLD_DAYS) }), now)).toBe(true)
  })

  it("does not hold two-star reviews, only one-star", () => {
    expect(isVisible(review({ rating: 2, date: daysAgo(1) }), now)).toBe(true)
  })

  // Fail open: an unparseable date must not silently hide a real review.
  it("shows a one-star review whose date is unparseable", () => {
    expect(isVisible(review({ rating: 1, date: "not a date" }), now)).toBe(true)
  })
})
