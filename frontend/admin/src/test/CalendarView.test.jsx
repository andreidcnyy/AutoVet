import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { format } from "date-fns";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { token: "test-token", clinic_id: 1 } }),
}));

// Real-time updates are not under test; a stub channel that accepts listeners.
vi.mock("../utils/echo", () => {
  const channel = { listen: () => channel, stopListening: () => channel };
  return {
    default: { private: () => channel, leave: () => {}, leaveChannel: () => {} },
    adminChannel: (name) => `clinic.1.${name}`,
  };
});

import CalendarView from "../components/Calendar/CalendarView";

describe("CalendarView (appointment calendar)", () => {
  const today = format(new Date(), "yyyy-MM-dd");

  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => [
        { id: 7, date: today, time: "10:30", status: "approved", title: "Anti-Rabies Vaccine", pet_name: "Buboy" },
      ],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("renders the current month and the weekday headers", async () => {
    render(<CalendarView />);
    expect(screen.getByText(format(new Date(), "MMMM yyyy"))).toBeInTheDocument();
    for (const d of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      expect(screen.getByText(d)).toBeInTheDocument();
    }
    // Let the appointment fetch settle before the test ends.
    await screen.findByText("Anti-Rabies Vaccine");
  });

  it("loads appointments with the user's token and shows them on the right day", async () => {
    render(<CalendarView />);

    expect(await screen.findByText("Anti-Rabies Vaccine")).toBeInTheDocument();
    expect(screen.getByText("10:30 AM")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/appointments",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-token" }) })
    );
  });
});
