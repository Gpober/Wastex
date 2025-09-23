"use client";

import React from "react";
import { cn } from "@/lib/utils";

type DateRangePickerProps = {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
  className?: string;
};

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  className,
}: DateRangePickerProps) {
  const handleStartChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextStart = event.target.value;
    let nextEnd = endDate;

    if (nextStart && nextEnd && nextStart > nextEnd) {
      nextEnd = nextStart;
    }

    onChange(nextStart, nextEnd);
  };

  const handleEndChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextEnd = event.target.value;
    let nextStart = startDate;

    if (nextStart && nextEnd && nextEnd < nextStart) {
      nextStart = nextEnd;
    }

    onChange(nextStart, nextEnd);
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col text-xs font-medium text-gray-600">
          <span className="mb-1">Start</span>
          <input
            type="date"
            value={startDate}
            onChange={handleStartChange}
            max={endDate || undefined}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </label>
        <label className="flex flex-col text-xs font-medium text-gray-600">
          <span className="mb-1">End</span>
          <input
            type="date"
            value={endDate}
            onChange={handleEndChange}
            min={startDate || undefined}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </label>
      </div>
    </div>
  );
}
