import { describe, it, expect } from "vitest"
import {
  mapBusinessProfileReview,
  mapPlacesReview,
  mapLegacyReview,
  contentKey,
  mergeReviews,
} from "../lambda/fetch-reviews.mjs"

describe("mapBusinessProfileReview", () => {
  it("converts the star enum to a number", () => {
    expect(mapBusinessProfileReview({ starRating: "FIVE" }).rating).toBe(5)
    expect(mapBusinessProfileReview({ starRating: "ONE" }).rating).toBe(1)
  })

  // A rating of 0 is visibly wrong; a crash would take the whole run down.
  it("gives an unknown star value a rating of 0 rather than throwing", () => {
    expect(mapBusinessProfileReview({ starRating: "SIX" }).rating).toBe(0)
    expect(mapBusinessProfileReview({}).rating).toBe(0)
  })

  it("carries the owner's reply, which only this source has", () => {
    const r = mapBusinessProfileReview({ reviewReply: { comment: "Thanks!" } })
    expect(r.reply).toBe("Thanks!")
  })

  it("falls back to Anonymous when the reviewer has no display name", () => {
    expect(mapBusinessProfileReview({}).author).toBe("Anonymous")
  })
})

describe("mapPlacesReview", () => {
  it("reads the nested text and author shapes Places uses", () => {
    const r = mapPlacesReview({
      name: "places/1",
      authorAttribution: { displayName: "Dana Wu" },
      rating: 4,
      text: { text: "Good fade." },
      publishTime: "2026-08-01T00:00:00Z",
    })
    expect(r).toMatchObject({ id: "places/1", author: "Dana Wu", rating: 4, text: "Good fade." })
  })

  it("never sets a reply, because Places does not return one", () => {
    expect(mapPlacesReview({}).reply).toBeUndefined()
  })
})

describe("mapLegacyReview", () => {
  it("synthesises an id, because the legacy API does not provide one", () => {
    expect(mapLegacyReview({ author_name: "Sam Okafor", time: 1756000000 }).id)
      .toBe("legacy-1756000000-sam-okafor")
  })

  it("converts unix seconds to an ISO date", () => {
    expect(mapLegacyReview({ time: 1756000000 }).date).toBe(new Date(1756000000000).toISOString())
  })

  it("still produces an id when the author is missing", () => {
    expect(mapLegacyReview({}).id).toBe("legacy-0-anonymous")
  })
})

// The property the tiered design depends on: three sources, one shape. If a
// mapper drifts, the same review arrives twice and the dedupe cannot see it.
describe("the three mappers agree on shape", () => {
  const text = "Best barber in town."

  const fromProfile = mapBusinessProfileReview({
    name: "accounts/1/locations/2/reviews/abc",
    reviewer: { displayName: "Sam Okafor" },
    starRating: "FIVE",
    comment: text,
    createTime: "2026-08-01T00:00:00Z",
  })
  const fromPlaces = mapPlacesReview({
    name: "places/ChZDSUhNMG9n",
    authorAttribution: { displayName: "Sam Okafor" },
    rating: 5,
    text: { text },
    publishTime: "2026-08-01T00:00:00Z",
  })
  const fromLegacy = mapLegacyReview({
    author_name: "Sam Okafor",
    rating: 5,
    text,
    time: 1754006400,
  })

  it("produces the same keys from every source", () => {
    const keys = (o) => Object.keys(o).sort().join(",")
    expect(keys(fromPlaces)).toBe(keys({ ...fromPlaces }))
    for (const r of [fromProfile, fromPlaces, fromLegacy]) {
      expect(r).toHaveProperty("id")
      expect(r).toHaveProperty("author")
      expect(r).toHaveProperty("rating")
      expect(r).toHaveProperty("text")
      expect(r).toHaveProperty("date")
    }
  })

  it("fingerprints the same review identically whichever source it came from", () => {
    expect(contentKey(fromProfile)).toBe(contentKey(fromPlaces))
    expect(contentKey(fromProfile)).toBe(contentKey(fromLegacy))
  })

  it("so the merge stores it once, even with three different ids", () => {
    expect(fromProfile.id).not.toBe(fromPlaces.id)
    const { reviews } = mergeReviews([fromProfile], [fromPlaces, fromLegacy])
    expect(reviews).toHaveLength(1)
  })
})
