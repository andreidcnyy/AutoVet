import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth } from 'date-fns';

/**
 * Generates an array of exactly 42 date objects representing
 * a 6-week calendar view for a given month and year.
 */
export function generateCalendarGrid(currentDate: Date, events: any[] = []) {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);

    // To ensure the calendar always has 6 rows (42 days), we find the starting Sunday 
    // and ending Saturday.
    const startDate = startOfWeek(monthStart);
    let endDate = endOfWeek(monthEnd);

    // If the total days generated is less than 42, add an extra week to the end
    const totalDays = eachDayOfInterval({ start: startDate, end: endDate }).length;
    if (totalDays < 42) {
        endDate = new Date(endDate);
        endDate.setDate(endDate.getDate() + 7);
    }

    const daysInGrid = eachDayOfInterval({ start: startDate, end: endDate }).slice(0, 42);

    return daysInGrid.map(date => {
        const isCurrentMonth = isSameMonth(date, monthStart);
        const dateString = format(date, 'yyyy-MM-dd');

        // Find events that match this exact date - add safe guard for events
        const dayEvents = Array.isArray(events) ? events.filter(e => e.date === dateString) : [];

        return {
            date: date,
            day: parseInt(format(date, 'd'), 10),
            inMonth: isCurrentMonth,
            dateString: dateString,
            events: dayEvents,
        };
    });
}
