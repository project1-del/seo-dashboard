import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, subDays } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getDateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = subDays(end, days);
  return {
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
  };
}

export function formatNumber(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

export function positionColor(pos: number): string {
  if (pos <= 3) return "text-green-600";
  if (pos <= 10) return "text-yellow-600";
  if (pos <= 20) return "text-orange-500";
  return "text-red-500";
}
