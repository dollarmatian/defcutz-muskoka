"use client"

import { useEffect, useState } from "react"
import {
  type BusinessHoursData,
  groupHoursForDisplay,
} from "@/lib/business-hours"

type Variant = "compact" | "full"

interface BusinessHoursProps {
  /** "compact" = grouped one-liners (footer / sidebar), "full" = full 7-day table */
  variant?: Variant
  /** Extra CSS classes on the wrapper */
  className?: string
  /** Text colour class for the hours lines */
  textClass?: string
}

export function BusinessHours({
  variant = "compact",
  className = "",
  textClass = "text-gray-300",
}: BusinessHoursProps) {
  const [data, setData] = useState<BusinessHoursData | null>(null)

  useEffect(() => {
    fetch("/data/hours.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {
        // If fetch fails, the component simply renders nothing (static fallback is in the HTML)
      })
  }, [])

  if (!data) {
    // Render a loading placeholder while fetching
    return (
      <div className={className}>
        <span className={textClass}>Loading hours...</span>
      </div>
    )
  }

  if (variant === "full") {
    return <FullHours data={data} className={className} textClass={textClass} />
  }

  return <CompactHours data={data} className={className} textClass={textClass} />
}

function CompactHours({
  data,
  className,
  textClass,
}: {
  data: BusinessHoursData
  className: string
  textClass: string
}) {
  const { groups, closedDays } = groupHoursForDisplay(data.hours)

  return (
    <div className={className}>
      {groups.map((g, i) => (
        <p key={i} className={textClass}>
          {g.hours} ({g.days})
        </p>
      ))}
      {closedDays.length > 0 && (
        <p className={textClass}>CLOSED ({closedDays.join(", ")})</p>
      )}
    </div>
  )
}

function FullHours({
  data,
  className,
  textClass,
}: {
  data: BusinessHoursData
  className: string
  textClass: string
}) {
  return (
    <div className={className}>
      {data.hours.map((entry) => (
        <div key={entry.day} className={`flex justify-between gap-4 ${textClass}`}>
          <span className="font-medium">{entry.day}</span>
          <span>
            {entry.open && entry.close
              ? `${entry.open} - ${entry.close}`
              : "Closed"}
          </span>
        </div>
      ))}
    </div>
  )
}
