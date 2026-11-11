import { describe, it, expect } from "vitest";
import { generateCalendarGrid } from "../utils/calendarUtils";

describe("generateCalendarGrid (appointment calendar layout)", () => {
  const november2026 = new Date(2026, 10, 15);

  it("always builds a full 6-week grid of 42 days", () => {
    expect(generateCalendarGrid(november2026)).toHaveLength(42);
  });

  it("starts on a Sunday and flags which days belong to the month", () => {
    const grid = generateCalendarGrid(november2026);
    expect(grid[0].date.getDay()).toBe(0);
    const inMonth = grid.filter((d) => d.inMonth);
    expect(inMonth).toHaveLength(30); // November has 30 days
    expect(inMonth[0].dateString).toBe("2026-11-01");
    expect(inMonth[29].dateString).toBe("2026-11-30");
  });

  it("places each appointment on its own date only", () => {
    const events = [
      { id: 1, date: "2026-11-11", title: "Vaccination" },
      { id: 2, date: "2026-11-11", title: "Check-up" },
      { id: 3, date: "2026-11-20", title: "Grooming" },
    ];
    const grid = generateCalendarGrid(november2026, events);
    const day = (s) => grid.find((d) => d.dateString === s);

    expect(day("2026-11-11").events.map((e) => e.title)).toEqual(["Vaccination", "Check-up"]);
    expect(day("2026-11-20").events).toHaveLength(1);
    expect(day("2026-11-12").events).toHaveLength(0);
  });

  it("does not crash when the appointment list is not an array", () => {
    const grid = generateCalendarGrid(november2026, null);
    expect(grid.every((d) => d.events.length === 0)).toBe(true);
  });
});
