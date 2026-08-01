export const FREE_MAX_PROJECTS = 1;
export const FREE_MAX_FEEDBACK_PER_PROJECT = 10;

export type Plan = "free" | "paid";

export function isFreePlan(plan: string | null | undefined): boolean {
  return plan !== "paid";
}
