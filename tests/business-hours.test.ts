import { describe, it, expect } from "vitest"
import { groupHoursForDisplay, to24h, type DayHours } from "../lib/business-hours"

const day = (d: string, open: string, close: string): DayHours => ({ day: d, open, close })

describe("groupHoursForDisplay", () => {
  it("collapses consecutive days that share hours into one row", () => {
    const { groups } = groupHoursForDisplay([
      day("Thursday", "9:00 AM", "9:00 PM"),
      day("Friday", "9:00 AM", "9:00 PM"),
      day("Saturday", "9:00 AM", "9:00 PM"),
    ])
    expect(groups).toEqual([{ days: "Thu, Fri, Sat", hours: "9:00 AM - 9:00 PM" }])
  })

  it("starts a new row when the hours change", () => {
    const { groups } = groupHoursForDisplay([
      day("Monday", "9:00 AM", "5:00 PM"),
      day("Tuesday", "10:00 AM", "6:00 PM"),
    ])
    expect(groups).toHaveLength(2)
  })

  // A closed day does not break a run. "Mon, Wed" names both days explicitly
  // and Tuesday appears under closedDays, so nothing is misleading and it is
  // one row shorter. A day with different hours DOES break the run.
  it("keeps one row across a closed day, and lists that day as closed", () => {
    const { groups, closedDays } = groupHoursForDisplay([
      day("Monday", "9:00 AM", "5:00 PM"),
      day("Tuesday", "", ""),
      day("Wednesday", "9:00 AM", "5:00 PM"),
    ])
    expect(groups).toEqual([{ days: "Mon, Wed", hours: "9:00 AM - 5:00 PM" }])
    expect(closedDays).toEqual(["Tue"])
  })

  it("reports a day with no hours as closed rather than open with blank times", () => {
    const { groups, closedDays } = groupHoursForDisplay([day("Sunday", "", "")])
    expect(groups).toHaveLength(0)
    expect(closedDays).toEqual(["Sun"])
  })
})

describe("to24h", () => {
  it.each([
    ["9:00 AM", "09:00"],
    ["12:00 AM", "00:00"],  // midnight is 00, not 12
    ["12:00 PM", "12:00"],  // noon is 12, not 00
    ["1:30 PM", "13:30"],
    ["11:59 PM", "23:59"],
  ])("converts %s to %s", (input, expected) => {
    expect(to24h(input)).toBe(expected)
  })

  // This feeds schema.org JSON-LD. Returning something wrong would publish
  // incorrect opening hours to search engines silently.
  it("returns empty for anything it cannot parse", () => {
    expect(to24h("")).toBe("")
    expect(to24h("Closed")).toBe("")
    expect(to24h("25:00 PM")).toBe("")   // shape matches, value is impossible
    expect(to24h("9:99 AM")).toBe("")
  })
})
