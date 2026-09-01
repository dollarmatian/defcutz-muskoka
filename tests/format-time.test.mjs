import { describe, it, expect } from "vitest"
import { formatTime } from "../lambda/fetch-hours.mjs"

describe("formatTime", () => {
  it.each([
    [9, 0, "9:00 AM"],
    [0, 0, "12:00 AM"],   // midnight is 12 AM, not 0 AM
    [12, 0, "12:00 PM"],  // noon is 12 PM, not 0 PM
    [13, 30, "1:30 PM"],
    [23, 59, "11:59 PM"],
  ])("renders %i:%i as %s", (h, m, expected) => {
    expect(formatTime(h, m)).toBe(expected)
  })

  it("pads a single-digit minute", () => {
    expect(formatTime(9, 5)).toBe("9:05 AM")
  })

  it("returns empty for a day Google reports with no opening hour", () => {
    expect(formatTime(undefined, 0)).toBe("")
    expect(formatTime(null, 0)).toBe("")
  })

  it("treats a missing minute as on the hour", () => {
    expect(formatTime(10, undefined)).toBe("10:00 AM")
  })
})
