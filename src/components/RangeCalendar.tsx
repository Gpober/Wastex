"use client";

import * as React from "react";
import { addMonths, addYears, format, isAfter } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type RangeValue = {
  start: Date | null;
  end: Date | null;
};

type RangeCalendarProps = {
  value: RangeValue;
  onChange: (range: RangeValue) => void;
};

const toCalendarDate = (date: Date | null): Date | undefined => {
  if (!date) return undefined;
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
};

const toUtcDate = (date: Date | null | undefined): Date | null => {
  if (!date) return null;
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};

export default function RangeCalendar({ value, onChange }: RangeCalendarProps) {
  const selected = React.useMemo<DateRange | undefined>(() => {
    const start = toCalendarDate(value.start);
    const end = toCalendarDate(value.end);

    if (!start && !end) {
      return undefined;
    }

    if (start && end && isAfter(start, end)) {
      return { from: end, to: start };
    }

    return { from: start, to: end ?? start };
  }, [value.end, value.start]);

  const handleSelect = React.useCallback(
    (range: DateRange | undefined) => {
      if (!range?.from && !range?.to) {
        onChange({ start: null, end: null });
        return;
      }

      let start = range?.from ?? range?.to ?? null;
      let end = range?.to ?? range?.from ?? null;

      if (start && end && isAfter(start, end)) {
        [start, end] = [end, start];
      }

      onChange({ start: toUtcDate(start), end: toUtcDate(end) });
    },
    [onChange]
  );

  const defaultMonth = React.useMemo(() => {
    if (selected?.from) return selected.from;
    if (selected?.to) return selected.to;
    return new Date();
  }, [selected]);

  const [displayMonth, setDisplayMonth] = React.useState(defaultMonth);

  React.useEffect(() => {
    setDisplayMonth(defaultMonth);
  }, [defaultMonth]);

  const handleMonthChange = React.useCallback((month: Date) => {
    setDisplayMonth(month);
  }, []);

  const handlePreviousMonth = React.useCallback(() => {
    setDisplayMonth((month) => addMonths(month, -1));
  }, []);

  const handleNextMonth = React.useCallback(() => {
    setDisplayMonth((month) => addMonths(month, 1));
  }, []);

  const handlePreviousYear = React.useCallback(() => {
    setDisplayMonth((month) => addYears(month, -1));
  }, []);

  const handleNextYear = React.useCallback(() => {
    setDisplayMonth((month) => addYears(month, 1));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handlePreviousMonth}
          aria-label="Previous month"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">
          {format(displayMonth, "MMMM")}
        </span>
        <button
          type="button"
          onClick={handleNextMonth}
          aria-label="Next month"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <Calendar
        mode="range"
        selected={selected}
        month={displayMonth}
        onMonthChange={handleMonthChange}
        onSelect={handleSelect}
        hideNavigation
        weekStartsOn={0}
        components={{
          IconLeft: () => <ChevronLeft className="h-4 w-4" />,
          IconRight: () => <ChevronRight className="h-4 w-4" />,
          Caption: () => null,
        }}
        classNames={{
          caption: "hidden",
        }}
      />
      <div className="flex items-center justify-center space-x-4">
        <button
          type="button"
          onClick={handlePreviousYear}
          aria-label="Previous year"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">{format(displayMonth, "yyyy")}</span>
        <button
          type="button"
          onClick={handleNextYear}
          aria-label="Next year"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
