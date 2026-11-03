import { beforeEach, describe, expect, it } from "vitest";
import {
  DISMISSED_UNTIL_KEY,
  FIRST_VISIT_KEY,
  dismissPromo,
  evaluatePromo,
  isExcludedPath,
} from "@/lib/returnVisitorPromo";

describe("return visitor promo", () => {
  beforeEach(() => localStorage.clear());

  it("first visit stores local date and does not show", () => {
    expect(evaluatePromo(localStorage, new Date(2026, 10, 3, 10))).toBe(false);
    expect(localStorage.getItem(FIRST_VISIT_KEY)).toBe("2026-11-03");
  });

  it("same-day reload does not show", () => {
    evaluatePromo(localStorage, new Date(2026, 10, 3, 9));
    expect(evaluatePromo(localStorage, new Date(2026, 10, 3, 23, 59))).toBe(false);
  });

  it("next day shows", () => {
    evaluatePromo(localStorage, new Date(2026, 10, 3, 9));
    expect(evaluatePromo(localStorage, new Date(2026, 10, 4, 0, 1))).toBe(true);
  });

  it("dismiss hides for 7 days", () => {
    evaluatePromo(localStorage, new Date(2026, 10, 1));
    const now = new Date(2026, 10, 3, 12);
    dismissPromo(localStorage, now);
    expect(localStorage.getItem(DISMISSED_UNTIL_KEY)).toBeTruthy();
    expect(evaluatePromo(localStorage, new Date(2026, 10, 10, 11))).toBe(false);
    expect(evaluatePromo(localStorage, new Date(2026, 10, 10, 13))).toBe(true);
  });

  it("excludes room and admin pages only", () => {
    expect(isExcludedPath("/room")).toBe(true);
    expect(isExcludedPath("/admin")).toBe(true);
    expect(isExcludedPath("/")).toBe(false);
  });
});
