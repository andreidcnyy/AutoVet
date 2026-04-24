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
export const calculateAgeDisplay = (dateOfBirth: string) => {
    if (!dateOfBirth) return 'N/A';
    
    const birth = new Date(dateOfBirth);
    const now = new Date();
    
    if (isNaN(birth.getTime()) || birth > now) return 'N/A';
    
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    
    if (months < 0) {
        years--;
        months += 12;
    }
    
    if (years === 0) {
        return `${months} ${months === 1 ? 'month' : 'months'} old`;
    }
    
    if (months === 0) {
        return `${years} ${years === 1 ? 'year' : 'years'} old`;
    }
    
    return `${years}y ${months}m old`;
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
