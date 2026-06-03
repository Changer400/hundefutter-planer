export type FoodType = "TF" | "BARF";

export type DayKey =
  | "Montag"
  | "Dienstag"
  | "Mittwoch"
  | "Donnerstag"
  | "Freitag"
  | "Samstag"
  | "Sonntag";

export const DAYS: DayKey[] = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];

export type MealKey = "morgens" | "mittags" | "nachmittags" | "abends";

export type AppointmentStatus = "Offen" | "Erledigt" | "Verschoben";

export interface Reminder {
  morgens: string;
  mittags: string;
  nachmittags: string;
  abends: string;
}

export type FoodUnit = "g" | "kg" | "Stück" | "Beutel" | "Dose";

export type FoodCategory = "TF" | "BARF" | "NF" | "andere";

export interface FoodStockEntry {
  id: string;
  name: string;
  amount: number;
  unit: FoodUnit;
  category: FoodCategory;
  /** Tagesverbrauch in derselben Einheit wie `unit`. Undefined → auto bei TF/BARF in g/kg. */
  dailyConsumption?: number;
  /** Warnschwelle in Tagen. Default = 7. */
  lowDays?: number;
}

export interface CustomShoppingRow {
  id: string;
  name: string;
  amount: string;
  note: string;
  done: boolean;
}

export interface Appointment {
  id: string;
  date: string;
  treatment: string;
  status: AppointmentStatus;
  notes: string;
  next: string;
  builtin?: boolean;
}

export interface AppState {
  birthDate: string;
  weightKg: number;
  defaultFoodType: FoodType;
  /** Benutzerdefinierte Mahlzeiten pro Tag. undefined/0 → automatisch je Alter. */
  customMealsPerDay?: number;
  stockG: number;
  lastFedDate: string | null;
  lastFedEntryId?: string | null;
  lastFedAmount?: number | null;
  feedAutoEnabled?: boolean;
  feedSchedule?: Partial<Record<DayKey, { entryId: string; amount: number }>>;
  feedOverride?: { date: string; entryId: string; amount: number } | null;
  reminders: Reminder;
  weekPlan: Record<DayKey, FoodType>;
  shoppingDone: Record<string, boolean>;
  customShopping: CustomShoppingRow[];
  appointments: Appointment[];
  foodStocks: FoodStockEntry[];
}
