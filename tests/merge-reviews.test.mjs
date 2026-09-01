import { describe, it, expect } from "vitest"
import { mergeReviews, contentKey } from "../lambda/fetch-reviews.mjs"

const review = (over = {}) => ({
  id: "a1",
  author: "Sam Okafor",
  rating: 5,
  text: "Great cut, friendly shop.",
  date: "2026-08-01T12:00:00Z",
  ...over,
})

describe("contentKey", () => {
  it("ignores case and surrounding whitespace so the same review fingerprints once", () => {
    expect(contentKey(review({ author: "  Sam Okafor " }))).toBe(
      contentKey(review({ author: "sam okafor" }))
    )
  })

  it("separates two different people who left the same rating and words", () => {
    expect(contentKey(review({ author: "Sam Okafor" }))).not.toBe(
      contentKey(review({ author: "Dana Wu" }))
    )
  })

  it("tolerates a review with no text, which the Places API returns", () => {
    expect(() => contentKey({ author: "Sam", rating: 4 })).not.toThrow()
  })
})

describe("mergeReviews", () => {
  it("adds a review that is genuinely new", () => {
    const { reviews, newCount } = mergeReviews([review()], [review({ id: "b2", text: "Second visit." })])
    expect(newCount).toBe(1)
    expect(reviews).toHaveLength(2)
  })

  it("does not add the same id twice", () => {
    const { reviews, newCount } = mergeReviews([review()], [review()])
    expect(newCount).toBe(0)
    expect(reviews).toHaveLength(1)
  })

  // The reason the content fingerprint exists at all.
  it("catches the same review arriving from the other API under a different id", () => {
    const fromBusinessProfile = review({ id: "accounts/1/locations/2/reviews/abc" })
    const fromPlaces = review({ id: "ChZDSUhNMG9nS0VJQ0FnSUR" })
    const { reviews, newCount } = mergeReviews([fromBusinessProfile], [fromPlaces])
    expect(newCount).toBe(0)
    expect(reviews).toHaveLength(1)
  })

  // The invariant the whole design exists to protect.
  it("never shrinks the collection when a degraded source returns fewer reviews", () => {
    const stored = Array.from({ length: 80 }, (_, i) =>
      review({ id: `stored-${i}`, text: `Review number ${i}` })
    )
    const { reviews } = mergeReviews(stored, [review({ id: "stored-3", text: "Review number 3" })])
    expect(reviews).toHaveLength(80)
  })

  it("returns newest first", () => {
    const { reviews } = mergeReviews(
      [review({ id: "old", date: "2024-01-01T00:00:00Z", text: "Older" })],
      [review({ id: "new", date: "2026-08-30T00:00:00Z", text: "Newer" })]
    )
    expect(reviews.map((r) => r.id)).toEqual(["new", "old"])
  })

  it("does not mutate the array it was given", () => {
    const stored = [review()]
    mergeReviews(stored, [review({ id: "b2", text: "Another" })])
    expect(stored).toHaveLength(1)
  })

  it("survives a review with a missing date rather than throwing", () => {
    const { reviews } = mergeReviews([], [review({ id: "nodate", date: undefined })])
    expect(reviews).toHaveLength(1)
  })
})
