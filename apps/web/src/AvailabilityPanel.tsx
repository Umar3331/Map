import { useEffect, useMemo, useState } from 'react'

import {
  addDays,
  dateInTimezone,
  loadAvailability,
  localTime,
  type AvailabilityResponse,
  type AvailabilitySlot,
  type BookableOffering,
} from './availability'

type AvailabilityPanelProps = {
  offering: BookableOffering
  onBack: () => void
  onClose: () => void
}

function dateLabel(value: string, timezone: string): { weekday: string; day: string } {
  const date = new Date(`${value}T12:00:00Z`)
  return {
    weekday: new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: timezone }).format(date),
    day: new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', timeZone: timezone }).format(date),
  }
}

function emptyMessage(status: string): string {
  if (status === 'closed') return 'Closed'
  if (status === 'no_schedule') return 'No schedule configured'
  return 'No available times'
}

export function AvailabilityPanel({ offering, onBack, onClose }: AvailabilityPanelProps) {
  const initialDate = useMemo(() => dateInTimezone(offering.timezone), [offering.timezone])
  const finalDate = useMemo(() => addDays(initialDate, 6), [initialDate])
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null)
  const [view, setView] = useState<
    | { status: 'loading' }
    | { status: 'ready'; availability: AvailabilityResponse }
    | { status: 'error' }
  >({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    loadAvailability(offering.id, initialDate, finalDate, controller.signal)
      .then((availability) => setView({ status: 'ready', availability }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setView({ status: 'error' })
      })
    return () => controller.abort()
  }, [finalDate, initialDate, offering.id])

  const selectedDay = view.status === 'ready'
    ? view.availability.days.find((day) => day.date === selectedDate)
    : undefined

  const selectDate = (value: string) => {
    setSelectedDate(value)
    setSelectedSlot(null)
  }

  return (
    <aside className="place-details availability-panel" role="dialog" aria-label="Service availability">
      <div className="provider-profile-actions">
        <button className="provider-back" type="button" onClick={onBack} aria-label="Back to provider profile">
          ← Provider
        </button>
        <button className="place-details-close" type="button" onClick={onClose} aria-label="Close availability">
          ×
        </button>
      </div>
      <span className="provider-eyebrow">Availability</span>
      <h1>{offering.service_name}</h1>
      <p className="availability-location">{offering.place_name} · {offering.city}</p>
      <p className="availability-demo">Demo schedule — not provider-supplied availability.</p>

      {view.status === 'loading' && <p className="availability-state" role="status">Loading availability…</p>}
      {view.status === 'error' && (
        <p className="availability-state availability-error" role="alert">
          Availability is temporarily unavailable
        </p>
      )}
      {view.status === 'ready' && (
        <>
          <div className="availability-dates" role="list" aria-label="Upcoming dates">
            {view.availability.days.map((day) => {
              const label = dateLabel(day.date, offering.timezone)
              return (
                <button
                  key={day.date}
                  type="button"
                  role="listitem"
                  aria-label={`${label.weekday} ${label.day}`}
                  className={day.date === selectedDate ? 'availability-date availability-date-selected' : 'availability-date'}
                  aria-pressed={day.date === selectedDate}
                  onClick={() => selectDate(day.date)}
                >
                  <span>{label.weekday}</span>
                  <strong>{label.day}</strong>
                </button>
              )
            })}
          </div>
          <section className="availability-slots" aria-live="polite">
            <h2>{dateLabel(selectedDate, offering.timezone).weekday}, {dateLabel(selectedDate, offering.timezone).day}</h2>
            {selectedDay && selectedDay.slots.length > 0 ? (
              <div className="availability-slot-grid">
                {selectedDay.slots.map((slot) => (
                  <button
                    key={slot.starts_at_utc}
                    type="button"
                    className={selectedSlot?.starts_at_utc === slot.starts_at_utc
                      ? 'availability-slot availability-slot-selected'
                      : 'availability-slot'}
                    aria-pressed={selectedSlot?.starts_at_utc === slot.starts_at_utc}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {localTime(slot.starts_at)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="availability-empty">{emptyMessage(selectedDay?.status ?? 'no_availability')}</p>
            )}
          </section>
          {selectedSlot && (
            <p className="availability-selection" role="status">
              Selected {localTime(selectedSlot.starts_at)} for preview. No booking has been created.
            </p>
          )}
        </>
      )}
    </aside>
  )
}
