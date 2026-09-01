import type { CategoryOption, TrackingEvent } from "@proj/shared";
import { HttpError } from "../http-error";

export interface ResolvedCategory {
  categoryId: string;
  categoryLabel: string;
  subCategoryId: string;
  subCategoryLabel: string;
}

/** Turns the ids the app sends into the labels stored on the request. */
export function resolveCategory(
  catalog: CategoryOption[],
  categoryId: unknown,
  subCategoryId: unknown
): ResolvedCategory {
  const category = catalog.find((c) => c.id === categoryId);
  if (!category) throw HttpError.badRequest("Please pick a category.");

  const sub = category.subCategories.find((s) => s.id === subCategoryId);
  if (!sub) throw HttpError.badRequest("Please pick a sub-category.");

  return {
    categoryId: category.id,
    categoryLabel: category.label,
    subCategoryId: sub.id,
    subCategoryLabel: sub.label,
  };
}

export function requireRemarks(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < 5) {
    throw HttpError.badRequest(
      "Add a few words about the issue so the team knows what to do."
    );
  }
  return value.trim();
}

export function photoList(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw HttpError.badRequest("Photos must be a list of image references.");
  }
  return value as string[];
}

export function openedTimeline(note: string): TrackingEvent[] {
  return [{ status: "submitted", note, at: new Date().toISOString() }];
}
