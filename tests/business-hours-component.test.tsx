// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import { BusinessHours } from "../components/business-hours"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const hoursPayload = {
  businessStatus: "OPERATIONAL",
  isOpenNow: true,
  weekdayText: [],
  fetchedAt: "2026-09-01T00:00:00Z",
  hours: [
    { day: "Monday", open: "9:00 AM", close: "5:00 PM" },
    { day: "Tuesday", open: "9:00 AM", close: "5:00 PM" },
    { day: "Sunday", open: "", close: "" },
  ],
}

const mockFetch = (impl: () => Promise<unknown>) =>
  vi.stubGlobal("fetch", vi.fn().mockImplementation(impl))

describe("<BusinessHours />", () => {
  it("shows a placeholder before the data arrives", () => {
    mockFetch(() => new Promise(() => {})) // never resolves
    render(<BusinessHours />)
    expect(screen.getByText(/loading hours/i)).toBeDefined()
  })

  it("renders the grouped hours once the fetch resolves", async () => {
    mockFetch(async () => ({ ok: true, json: async () => hoursPayload }))
    const { container } = render(<BusinessHours />)

    await waitFor(() => {
      expect(container.textContent).toContain("9:00 AM - 5:00 PM")
    })
    // Two days with identical hours collapse into one row.
    expect(container.textContent).toContain("Mon, Tue")
  })

  it("reads the file the Lambda writes, not a Google endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => hoursPayload })
    vi.stubGlobal("fetch", fetchMock)
    render(<BusinessHours />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0][0]).toBe("/data/hours.json")
  })

  // The site must not break because the JSON is missing or malformed. The
  // component is meant to render nothing rather than throw.
  it("stays silent when the fetch fails", async () => {
    mockFetch(async () => { throw new Error("network down") })
    const { container } = render(<BusinessHours />)
    await new Promise((r) => setTimeout(r, 20))
    expect(container.textContent).toContain("Loading hours")
  })
})
