"use client";

import * as React from "react";
import { isAfter } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";

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

  return (
    <Calendar
      mode="range"
      numberOfMonths={2}
      selected={selected}
      defaultMonth={defaultMonth}
      pagedNavigation
      onSelect={handleSelect}
      weekStartsOn={0}
    />
  );
}
