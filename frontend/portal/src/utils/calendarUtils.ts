import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, startOfDay } from 'date-fns';

/**
 * Generates an array of date objects representing
 * a calendar view for a given month and year.
 */
export function generateCalendarGrid(currentDate: Date, events: any[] = []) {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);

    // To ensure the calendar has a full grid, we find starting Sunday and ending Saturday
    const startDate = startOfWeek(monthStart);
    let endDate = endOfWeek(monthEnd);

    const totalDaysNeeded = 42;
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    let daysInGrid = [...days];
    if (daysInGrid.length < totalDaysNeeded) {
        const remaining = totalDaysNeeded - daysInGrid.length;
        const lastDay = daysInGrid[daysInGrid.length - 1];
        for (let i = 1; i <= remaining; i++) {
            const nextDay = new Date(lastDay);
            nextDay.setDate(lastDay.getDate() + i);
            daysInGrid.push(nextDay);
        }
    }

    return daysInGrid.slice(0, 42).map(date => {
        const isCurrentMonth = isSameMonth(date, monthStart);
        const dateString = format(date, 'yyyy-MM-dd');
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

/**
 * Generates an array of 7 days representing the current week.
 */
export function generateWeekGrid(currentDate: Date, events: any[] = []) {
    const startDate = startOfWeek(currentDate);
    const endDate = endOfWeek(currentDate);

    return eachDayOfInterval({ start: startDate, end: endDate }).map(date => {
        const dateString = format(date, 'yyyy-MM-dd');
        const dayEvents = Array.isArray(events) ? events.filter(e => e.date === dateString) : [];

        return {
            date: date,
            day: parseInt(format(date, 'd'), 10),
            inMonth: true,
            dateString: dateString,
            events: dayEvents,
        };
    });
}

/**
 * Generates a single day object for the calendar grid.
 */
export function generateDayGrid(currentDate: Date, events: any[] = []) {
    const date = startOfDay(currentDate);
    const dateString = format(date, 'yyyy-MM-dd');
    const dayEvents = Array.isArray(events) ? events.filter(e => e.date === dateString) : [];

    return [{
        date: date,
        day: parseInt(format(date, 'd'), 10),
        inMonth: true,
        dateString: dateString,
        events: dayEvents,
    }];
}

