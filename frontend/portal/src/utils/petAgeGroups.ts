// src/utils/petAgeGroups.ts
import { AGE_THRESHOLDS, AGE_GROUPS } from '../constants/petAgeThresholds';

/**
 * Calculates the age of a pet in months based on their date of birth.
 */
export const calculateAgeInMonths = (dateOfBirth: string) => {
    if (!dateOfBirth) return null;
    
    const birth = new Date(dateOfBirth);
    const now = new Date();
    
    // Check if birth date is valid and not in the future
    if (isNaN(birth.getTime()) || birth > now) return null;
    
    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();
    
    return (years * 12) + months;
};

/**
 * Calculates the human-readable age of a pet.
 */
/**
 * Human-readable age for a pet.
 *
 * The month arithmetic now accounts for the day of the month, so a pet born on
 * the 30th is not aged a full month on the 1st. Anything under a month reads in
 * days or weeks rather than collapsing to "0 months old", and the mixed case
 * spells its units instead of the cramped "3y 2m".
 */
export const calculateAgeDisplay = (dateOfBirth: string) => {
    if (!dateOfBirth) return 'Age unknown';

    const birth = new Date(dateOfBirth);
    const now = new Date();

    if (isNaN(birth.getTime()) || birth > now) return 'Age unknown';

    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();

    // Not a full month yet if the day of the month has not come round.
    if (now.getDate() < birth.getDate()) months--;

    if (months < 0) {
        years--;
        months += 12;
    }

    if (years === 0 && months === 0) {
        const days = Math.max(0, Math.floor((now.getTime() - birth.getTime()) / 86400000));
        if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} old`;
        const weeks = Math.floor(days / 7);
        return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} old`;
    }

    if (years === 0) {
        return `${months} ${months === 1 ? 'month' : 'months'} old`;
    }

    if (months === 0) {
        return `${years} ${years === 1 ? 'year' : 'years'} old`;
    }

    return `${years} ${years === 1 ? 'yr' : 'yrs'} ${months} ${months === 1 ? 'mo' : 'mos'} old`;
};

/**
 * Determines the age group label based on species and age in months.
 */
export const getAgeGroup = (speciesName: string | undefined, dateOfBirth: string) => {
    if (!dateOfBirth) return AGE_GROUPS.UNDETERMINED;
    
    const ageMonths = calculateAgeInMonths(dateOfBirth);
    if (ageMonths === null) return AGE_GROUPS.UNDETERMINED;
    
    const thresholds = (speciesName && (AGE_THRESHOLDS as any)[speciesName]) || AGE_THRESHOLDS.Default;
    
    if (ageMonths <= thresholds.Baby) {
        return AGE_GROUPS.BABY;
    } else if (ageMonths <= thresholds.Young) {
        return AGE_GROUPS.YOUNG;
    } else if (ageMonths <= thresholds.Adult) {
        return AGE_GROUPS.ADULT;
    } else {
        return AGE_GROUPS.SENIOR;
    }
};
