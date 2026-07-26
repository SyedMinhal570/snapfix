export type Severity = "low" | "medium" | "high" | "critical";

const CRITICAL_WORDS = [
  "critical",
  "urgent",
  "emergency",
  "down",
  "outage",
  "security",
  "data loss",
  "dataloss",
];

const HIGH_WORDS = [
  "crash",
  "broken",
  "fail",
  "failure",
  "error",
  "bug",
  "cannot",
  "can't",
  "unable",
  "block",
  "blocker",
  "severe",
];

const LOW_WORDS = [
  "typo",
  "minor",
  "cosmetic",
  "nit",
  "suggestion",
  "ui polish",
  "spacing",
  "alignment",
];

function containsWord(text: string, word: string): boolean {
  return text.includes(word);
}

/** Assign severity from title + description using simple keyword matching. */
export function detectSeverity(title: string, description: string): Severity {
  const text = `${title} ${description}`.toLowerCase();

  if (CRITICAL_WORDS.some((w) => containsWord(text, w))) return "critical";
  if (HIGH_WORDS.some((w) => containsWord(text, w))) return "high";
  if (LOW_WORDS.some((w) => containsWord(text, w))) return "low";
  return "medium";
}

export const severityLabels: Record<Severity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

/** Higher number = more severe, used for sorting. */
export const severityRank: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export const severityStyles: Record<Severity, string> = {
  low: "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-400/20",
  medium:
    "bg-yellow-50 text-yellow-800 ring-yellow-600/20 dark:bg-yellow-950 dark:text-yellow-300 dark:ring-yellow-400/20",
  high: "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-950 dark:text-orange-300 dark:ring-orange-400/20",
  critical:
    "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950 dark:text-red-300 dark:ring-red-400/20",
};
