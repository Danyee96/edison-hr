"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type DateLike = string | Date | undefined | null

interface DatePickerProps {
  value?: string
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  onChange?: (date: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

interface DateRangePickerProps {
  startValue?: string
  endValue?: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
  startPlaceholder?: string
  endPlaceholder?: string
  disabled?: boolean
  className?: string
}

interface InlineDateRangeCalendarProps {
  startValue?: string
  endValue?: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
  disabled?: boolean
  className?: string
}

interface MonthPickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

interface InlineMonthCalendarProps {
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

const weekDays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function parseDate(value: DateLike): Date | undefined {
  if (!value) return undefined
  const parsed = value instanceof Date ? value : parseISO(value)
  return isValid(parsed) ? parsed : undefined
}

function toDateValue(date?: Date): string {
  return date ? format(date, "yyyy-MM-dd") : ""
}

function displayDate(value?: string, placeholder = "dd/mm/yyyy"): string {
  const date = parseDate(value)
  return date ? format(date, "dd/MM/yyyy") : placeholder
}

function parseMonth(value?: string): Date | undefined {
  if (!value) return undefined
  const parsed = parseISO(`${value}-01`)
  return isValid(parsed) ? parsed : undefined
}

function toMonthValue(date: Date): string {
  return format(date, "yyyy-MM")
}

function displayMonth(value?: string, placeholder = "Select month"): string {
  const date = parseMonth(value)
  return date ? format(date, "MMMM yyyy") : placeholder
}

function getCalendarDays(month: Date) {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })
}

function isBetween(day: Date, start?: Date, end?: Date) {
  if (!start || !end) return false
  const rangeStart = isBefore(start, end) ? start : end
  const rangeEnd = isAfter(start, end) ? start : end
  return (isAfter(day, rangeStart) || isSameDay(day, rangeStart)) && (isBefore(day, rangeEnd) || isSameDay(day, rangeEnd))
}

function CalendarPanel({
  month,
  setMonth,
  selected,
  rangeStart,
  rangeEnd,
  rangeDraftEnd,
  onDayClick,
  onDayHover,
  onDone,
  closeOnSelect = true,
  showDone = true,
  className,
}: {
  month: Date
  setMonth: (date: Date) => void
  selected?: Date
  rangeStart?: Date
  rangeEnd?: Date
  rangeDraftEnd?: Date
  onDayClick: (day: Date) => void
  onDayHover?: (day: Date) => void
  onDone: () => void
  closeOnSelect?: boolean
  showDone?: boolean
  className?: string
}) {
  const effectiveRangeEnd = rangeEnd || rangeDraftEnd
  const days = getCalendarDays(month)

  return (
    <div className={cn("w-[220px] rounded-2xl border border-slate-100 bg-white p-2 text-slate-950 shadow-[0_12px_30px_rgba(15,23,42,0.12)]", className)}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-slate-400 shadow-[0_6px_14px_rgba(15,23,42,0.08)] transition hover:text-slate-700"
          onClick={() => setMonth(subMonths(month, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-base font-semibold">{format(month, "MMMM yyyy")}</div>
        <button
          type="button"
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-slate-400 shadow-[0_6px_14px_rgba(15,23,42,0.08)] transition hover:text-slate-700"
          onClick={() => setMonth(addMonths(month, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 border-t border-slate-200 pt-3">
        <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400">
          {weekDays.map((day) => <div key={day}>{day}</div>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-y-1 text-center">
          {days.map((day) => {
            const outside = !isSameMonth(day, month)
            const selectedDay = selected && isSameDay(day, selected)
            const startDay = rangeStart && isSameDay(day, rangeStart)
            const endDay = effectiveRangeEnd && isSameDay(day, effectiveRangeEnd)
            const inRange = isBetween(day, rangeStart, effectiveRangeEnd)

            return (
              <button
                key={day.toISOString()}
                type="button"
                onMouseEnter={() => onDayHover?.(day)}
                onClick={() => {
                  onDayClick(day)
                  // Auto-close for single-date pickers (not range)
                  if (closeOnSelect && !rangeStart && !rangeEnd && !rangeDraftEnd) onDone()
                }}
                className={cn(
                  "relative mx-auto flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold transition",
                  outside ? "text-slate-300" : "text-slate-950",
                  inRange && "bg-blue-50 text-blue-700",
                  (startDay || endDay) && "bg-blue-600 text-white shadow-[0_6px_14px_rgba(37,99,235,0.22)]",
                  selectedDay && "border-2 border-blue-500 bg-white text-blue-600",
                  !selectedDay && !startDay && !endDay && "hover:bg-slate-100"
                )}
              >
                {format(day, "d")}
              </button>
            )
          })}
        </div>
      </div>

      {showDone && (
        <div className="mt-3 flex justify-end">
          <Button type="button" className="h-8 rounded-md px-4 text-xs" onClick={onDone}>
            Done
          </Button>
        </div>
      )}
    </div>
  )
}

function MonthCalendarPanel({
  value,
  year,
  setYear,
  onSelect,
  className,
}: {
  value?: string
  year: number
  setYear: (value: number | ((current: number) => number)) => void
  onSelect: (monthIndex: number) => void
  className?: string
}) {
  const selectedMonth = parseMonth(value)

  return (
    <div className={cn("rounded-2xl border border-slate-100 bg-white p-3 text-slate-950 shadow-[0_12px_30px_rgba(15,23,42,0.12)]", className)}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous year"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-slate-400 shadow-[0_6px_14px_rgba(15,23,42,0.08)] transition hover:text-slate-700"
          onClick={() => setYear((current) => current - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-base font-semibold">{year}</div>
        <button
          type="button"
          aria-label="Next year"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-slate-400 shadow-[0_6px_14px_rgba(15,23,42,0.08)] transition hover:text-slate-700"
          onClick={() => setYear((current) => current + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200 pt-3">
        {monthNames.map((month, index) => {
          const selected = selectedMonth?.getFullYear() === year && selectedMonth?.getMonth() === index

          return (
            <button
              key={month}
              type="button"
              onClick={() => onSelect(index)}
              className={cn(
                "h-10 rounded-lg text-sm font-semibold transition",
                selected
                  ? "bg-blue-600 text-white shadow-[0_6px_14px_rgba(37,99,235,0.22)]"
                  : "bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:ring-1 hover:ring-blue-200"
              )}
            >
              {month}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DatePicker({
  value,
  selected,
  onSelect,
  onChange,
  placeholder = "dd/mm/yyyy",
  disabled = false,
  className,
}: DatePickerProps) {
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const popupRef = React.useRef<HTMLDivElement>(null)
  const initialDate = parseDate(value) || selected || new Date()
  const [open, setOpen] = React.useState(false)
  const [openUpward, setOpenUpward] = React.useState(false)
  const [month, setMonth] = React.useState(startOfMonth(initialDate))
  const selectedDate = parseDate(value) || selected

  React.useEffect(() => {
    const nextDate = parseDate(value) || selected
    if (nextDate) setMonth(startOfMonth(nextDate))
  }, [value, selected])

  React.useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        !wrapperRef.current?.contains(target) &&
        !popupRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  const handleSelect = (date: Date) => {
    onSelect?.(date)
    onChange?.(toDateValue(date))
  }

  const toggleOpen = () => {
    if (!open && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      setOpenUpward(window.innerHeight - rect.bottom < 260 && rect.top > 260)
    }
    setOpen((current) => !current)
  }

  const [panelStyle, setPanelStyle] = React.useState<React.CSSProperties>({})

  React.useEffect(() => {
    if (open && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      const top = openUpward ? rect.top - 8 : rect.bottom + 8
      setPanelStyle({
        left: rect.left,
        width: rect.width,
        position: 'fixed',
        zIndex: 70000,
        top,
      })
    }
  }, [open, openUpward])

  return (
    <div ref={wrapperRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-left text-sm shadow-sm transition hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selectedDate ? "text-slate-950" : "text-muted-foreground"}>{displayDate(toDateValue(selectedDate), placeholder)}</span>
        <CalendarIcon className="h-4 w-4 text-slate-500" />
      </button>
      {open && wrapperRef.current && createPortal(
        <div ref={popupRef} style={panelStyle}>
          <CalendarPanel
            month={month}
            setMonth={setMonth}
            selected={selectedDate}
            onDayClick={handleSelect}
            onDone={() => setOpen(false)}
          />
        </div>,
        document.body
      )}
    </div>
  )
}

export function DateRangePicker({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  startPlaceholder = "From",
  endPlaceholder = "To",
  disabled = false,
  className,
}: DateRangePickerProps) {
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const popupRef = React.useRef<HTMLDivElement>(null)
  const startDate = parseDate(startValue)
  const endDate = parseDate(endValue)
  const [open, setOpen] = React.useState(false)
  const [openUpward, setOpenUpward] = React.useState(false)
  const [selecting, setSelecting] = React.useState<"start" | "end">("start")
  const [draftEnd, setDraftEnd] = React.useState<Date | undefined>()
  const [month, setMonth] = React.useState(startOfMonth(startDate || endDate || new Date()))
  const [panelStyle, setPanelStyle] = React.useState<React.CSSProperties>({})

  React.useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        !wrapperRef.current?.contains(target) &&
        !popupRef.current?.contains(target)
      ) {
        setOpen(false)
        setDraftEnd(undefined)
      }
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  const selectDay = (day: Date) => {
    if (selecting === "start" || !startDate) {
      onStartChange(toDateValue(day))
      onEndChange("")
      setSelecting("end")
      setDraftEnd(undefined)
      return
    }

    if (isBefore(day, startDate)) {
      onEndChange(toDateValue(startDate))
      onStartChange(toDateValue(day))
    } else {
      onEndChange(toDateValue(day))
    }
    setSelecting("start")
    setDraftEnd(undefined)
  }

  const toggleOpen = () => {
    if (!open && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      setOpenUpward(window.innerHeight - rect.bottom < 260 && rect.top > 260)
    }
    setOpen((current) => !current)
  }

  React.useEffect(() => {
    if (open && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      const panelWidth = Math.min(Math.max(260, rect.width), window.innerWidth - 16)
      const panelHeight = 300
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - panelWidth - 8)
      const top = openUpward
        ? Math.max(8, rect.top - panelHeight - 8)
        : Math.min(rect.bottom + 8, window.innerHeight - panelHeight - 8)

      setPanelStyle({
        left,
        top,
        width: panelWidth,
        position: 'fixed',
        zIndex: 70000,
      })
    }
  }, [open, openUpward])

  return (
    <div ref={wrapperRef} className={cn("relative w-full min-w-[240px]", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-left text-sm shadow-sm transition hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={startDate || endDate ? "text-slate-950" : "text-muted-foreground"}>
          {displayDate(startValue, startPlaceholder)} - {displayDate(endValue, endPlaceholder)}
        </span>
        <CalendarIcon className="h-4 w-4 text-slate-500" />
      </button>
      {open && wrapperRef.current && createPortal(
        <div ref={popupRef} style={panelStyle}>
          <CalendarPanel
            month={month}
            setMonth={setMonth}
            rangeStart={startDate}
            rangeEnd={endDate}
            rangeDraftEnd={selecting === "end" ? draftEnd : undefined}
            onDayHover={(day) => selecting === "end" && setDraftEnd(day)}
            onDayClick={selectDay}
            closeOnSelect={false}
            onDone={() => {
              setOpen(false)
              setDraftEnd(undefined)
            }}
          />
        </div>,
        document.body
      )}
    </div>
  )
}

export function InlineDateRangeCalendar({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  disabled = false,
  className,
}: InlineDateRangeCalendarProps) {
  const startDate = parseDate(startValue)
  const endDate = parseDate(endValue)
  const [selecting, setSelecting] = React.useState<"start" | "end">("start")
  const [draftEnd, setDraftEnd] = React.useState<Date | undefined>()
  const [month, setMonth] = React.useState(startOfMonth(startDate || endDate || new Date()))

  React.useEffect(() => {
    if (startDate || endDate) setMonth(startOfMonth(startDate || endDate || new Date()))
  }, [startValue, endValue])

  const selectDay = (day: Date) => {
    if (disabled) return

    if (selecting === "start" || !startDate) {
      onStartChange(toDateValue(day))
      onEndChange("")
      setSelecting("end")
      setDraftEnd(undefined)
      return
    }

    if (isBefore(day, startDate)) {
      onEndChange(toDateValue(startDate))
      onStartChange(toDateValue(day))
    } else {
      onEndChange(toDateValue(day))
    }
    setSelecting("start")
    setDraftEnd(undefined)
  }

  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-3 shadow-sm", disabled && "opacity-60", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="font-semibold text-slate-950">
          {displayDate(startValue, "From")} - {displayDate(endValue, "To")}
        </div>
        <div className="text-xs font-medium text-slate-500">
          {selecting === "end" && startDate ? "Select end date" : "Select start date"}
        </div>
      </div>
      <CalendarPanel
        month={month}
        setMonth={setMonth}
        rangeStart={startDate}
        rangeEnd={endDate}
        rangeDraftEnd={selecting === "end" ? draftEnd : undefined}
        onDayHover={(day) => selecting === "end" && setDraftEnd(day)}
        onDayClick={selectDay}
        closeOnSelect={false}
        onDone={() => undefined}
        showDone={false}
        className="w-full border-slate-100 shadow-none"
      />
    </div>
  )
}

export function InlineMonthCalendar({
  value,
  onChange,
  disabled = false,
  className,
}: InlineMonthCalendarProps) {
  const selectedMonth = parseMonth(value)
  const [year, setYear] = React.useState((selectedMonth || new Date()).getFullYear())

  React.useEffect(() => {
    if (selectedMonth) setYear(selectedMonth.getFullYear())
  }, [value])

  return (
    <div className={cn(disabled && "opacity-60", className)}>
      <div className="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950 shadow-sm">
        {displayMonth(value, "Select month")}
      </div>
      <MonthCalendarPanel
        value={value}
        year={year}
        setYear={setYear}
        onSelect={(monthIndex) => {
          if (!disabled) onChange(toMonthValue(new Date(year, monthIndex, 1)))
        }}
        className="shadow-sm"
      />
    </div>
  )
}

export function MonthPicker({
  value,
  onChange,
  placeholder = "Select month",
  disabled = false,
  className,
}: MonthPickerProps) {
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const popupRef = React.useRef<HTMLDivElement>(null)
  const selectedMonth = parseMonth(value)
  const [open, setOpen] = React.useState(false)
  const [openUpward, setOpenUpward] = React.useState(false)
  const [year, setYear] = React.useState((selectedMonth || new Date()).getFullYear())
  const [panelStyle, setPanelStyle] = React.useState<React.CSSProperties>({})

  React.useEffect(() => {
    if (selectedMonth) setYear(selectedMonth.getFullYear())
  }, [value])

  React.useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        !wrapperRef.current?.contains(target) &&
        !popupRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  const toggleOpen = () => {
    if (!open && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      setOpenUpward(window.innerHeight - rect.bottom < 260 && rect.top > 260)
    }
    setOpen((current) => !current)
  }

  React.useEffect(() => {
    if (open && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      const panelWidth = Math.min(Math.max(300, rect.width), window.innerWidth - 16)
      const panelHeight = 265
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - panelWidth - 8)
      const top = openUpward
        ? Math.max(8, rect.top - panelHeight - 8)
        : Math.min(rect.bottom + 8, window.innerHeight - panelHeight - 8)

      setPanelStyle({
        left,
        top,
        width: panelWidth,
        position: 'fixed',
        zIndex: 70000,
      })
    }
  }, [open, openUpward])

  const selectMonth = (monthIndex: number) => {
    onChange(toMonthValue(new Date(year, monthIndex, 1)))
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className={cn("relative w-full min-w-[240px]", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-left text-sm shadow-sm transition hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selectedMonth ? "text-slate-950" : "text-muted-foreground"}>
          {displayMonth(value, placeholder)}
        </span>
        <CalendarIcon className="h-4 w-4 text-slate-500" />
      </button>
      {open && wrapperRef.current && createPortal(
        <div ref={popupRef} style={panelStyle}>
          <MonthCalendarPanel value={value} year={year} setYear={setYear} onSelect={selectMonth} />
        </div>,
        document.body
      )}
    </div>
  )
}
