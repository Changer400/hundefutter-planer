import type { DayKey, FoodType } from "./types";
import { DAYS } from "./types";

/** Age helpers */
export function ageInDays(birthDate: string, today = new Date()): number {
  if (!birthDate) return 0;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return 0;
  const ms = today.getTime() - b.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function ageInWeeks(birthDate: string, today = new Date()): number {
  return ageInDays(birthDate, today) / 7;
}

export function ageInMonths(birthDate: string, today = new Date()): number {
  // average month length ~30.437 days
  return ageInDays(birthDate, today) / 30.4375;
}

export interface FeedingRule {
  phase: "Welpe <4M" | "Welpe 4-6M" | "Jungh. 6-12M" | "Erwachsen";
  barfPct: number; // % of body weight per day
  mealsPerDay: number;
}

export function feedingRule(ageMonths: number): FeedingRule {
  if (ageMonths < 4)
    return { phase: "Welpe <4M", barfPct: 0.08, mealsPerDay: 4 };
  if (ageMonths < 6)
    return { phase: "Welpe 4-6M", barfPct: 0.07, mealsPerDay: 3 };
  if (ageMonths < 12)
    return { phase: "Jungh. 6-12M", barfPct: 0.05, mealsPerDay: 2 };
  return { phase: "Erwachsen", barfPct: 0.025, mealsPerDay: 2 };
}

/** Trockenfutter is roughly 1/3 of BARF by weight (calorie density ~3x). */
export const TF_RATIO = 1 / 3;

export function dailyAmounts(weightKg: number, ageMonths: number) {
  const rule = feedingRule(ageMonths);
  const barfGPerDay = Math.round(weightKg * 1000 * rule.barfPct);
  const tfGPerDay = Math.round(barfGPerDay * TF_RATIO);
  return {
    ...rule,
    barfGPerDay,
    tfGPerDay,
  };
}

export function perMeal(totalG: number, meals: number): number {
  if (meals <= 0) return 0;
  return Math.round(totalG / meals);
}

/** Get today's day key (Mo-So) */
export function todayKey(today = new Date()): DayKey {
  // JS: 0 = Sunday; we want Monday-first index
  const idx = (today.getDay() + 6) % 7;
  return DAYS[idx];
}

export function totalGForType(
  weekPlan: Record<DayKey, FoodType>,
  weightKg: number,
  ageMonths: number,
  type: FoodType,
): number {
  const d = dailyAmounts(weightKg, ageMonths);
  const perDay = type === "BARF" ? d.barfGPerDay : d.tfGPerDay;
  return DAYS.filter((d) => weekPlan[d] === type).length * perDay;
}

/**
 * Hunde-Alter in Menschenjahre umrechnen.
 * - Welpen-Phase (0–12 Mon): linear auf 15 Jahre skaliert
 * - 1.–2. Lebensjahr: 15 → 24 Jahre
 * - Danach: +4 (klein), +5 (mittel), +6 (groß), +7 (Riesen) pro Hundejahr
 */
export function humanAgeYears(ageMonths: number, weightKg: number): number {
  if (ageMonths <= 0) return 0;
  if (ageMonths <= 12) return (ageMonths / 12) * 15;
  if (ageMonths <= 24) return 15 + ((ageMonths - 12) / 12) * 9;
  const perYear =
    weightKg < 10 ? 4 : weightKg < 25 ? 5 : weightKg < 45 ? 6 : 7;
  return 24 + ((ageMonths - 24) / 12) * perYear;
}

export function formatHumanAge(years: number): string {
  if (years < 2) {
    const months = Math.round(years * 12);
    return `${months} Mon. (Mensch)`;
  }
  return `${years.toFixed(1)} Jahre (Mensch)`;
}

export function isoToday(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
