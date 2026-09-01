// Shared types and utilities for business hours

export type DayHours = {
  day: string
  open: string
  close: string
}

export type BusinessHoursData = {
  hours: DayHours[]
  businessStatus: string
  isOpenNow: boolean | null
  weekdayText: string[]
  fetchedAt: string
}

/**
 * Group days with identical hours into compact display rows.
 * e.g. "Thu, Fri, Sat: 9:00 AM - 9:00 PM"
 *
 * A closed day does not break a run, so Monday and Wednesday with the same
 * hours and Tuesday closed render as "Mon, Wed" with Tuesday in closedDays.
 * That is accurate and shorter than two rows. A day with DIFFERENT hours does
 * break the run.
 */
export function groupHoursForDisplay(hours: DayHours[]): {
  groups: { days: string; hours: string }[]
  closedDays: string[]
} {
  const groups: { days: string[]; open: string; close: string }[] = []
  const closedDays: string[] = []

  for (const entry of hours) {
    if (!entry.open || !entry.close) {
      closedDays.push(abbreviateDay(entry.day))
      continue
    }

    const lastGroup = groups[groups.length - 1]
    if (lastGroup && lastGroup.open === entry.open && lastGroup.close === entry.close) {
      lastGroup.days.push(abbreviateDay(entry.day))
    } else {
      groups.push({
        days: [abbreviateDay(entry.day)],
        open: entry.open,
        close: entry.close,
      })
    }
  }

  return {
    groups: groups.map((g) => ({
      days: g.days.join(", "),
      hours: `${g.open} - ${g.close}`,
    })),
    closedDays,
  }
}

/**
 * Convert "9:00 AM" back to "09:00" for schema.org JSON-LD.
 */
export function to24h(time12: string): string {
  if (!time12) return ""
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return ""
  let h = parseInt(match[1], 10)
  const m = match[2]
  // The shape can match while the values are impossible: "25:00 PM" parsed to
  // "37:00" and went into the schema.org markup, where nothing would notice.
  if (h < 1 || h > 12 || parseInt(m, 10) > 59) return ""
  const period = match[3].toUpperCase()
  if (period === "AM" && h === 12) h = 0
  if (period === "PM" && h !== 12) h += 12
  return `${String(h).padStart(2, "0")}:${m}`
}

function abbreviateDay(day: string): string {
  const abbrevs: Record<string, string> = {
    Monday: "Mon",
    Tuesday: "Tue",
    Wednesday: "Wed",
    Thursday: "Thu",
    Friday: "Fri",
    Saturday: "Sat",
    Sunday: "Sun",
  }
  return abbrevs[day] || day
}
