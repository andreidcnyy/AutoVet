// src/utils/petAgeGroups.js
import { AGE_THRESHOLDS, AGE_GROUPS } from '../constants/petAgeThresholds';

/**
 * Calculates the age of a pet in months based on their date of birth.
 * @param {string} dateOfBirth - YYYY-MM-DD
 * @returns {number|null} Age in months
 */
export const calculateAgeInMonths = (dateOfBirth) => {
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
 * Determines the age group label based on species and age in months.
 * @param {string} speciesName - The name of the species (Canine, Feline, etc.)
 * @param {string} dateOfBirth - YYYY-MM-DD
 * @returns {string} Age group label (Baby, Young, Adult, Senior)
 */
export const getAgeGroup = (speciesName, dateOfBirth) => {
    if (!dateOfBirth) return AGE_GROUPS.UNDETERMINED;
    
    const ageMonths = calculateAgeInMonths(dateOfBirth);
    if (ageMonths === null) return AGE_GROUPS.UNDETERMINED;
    
    const thresholds = AGE_THRESHOLDS[speciesName] || AGE_THRESHOLDS.Default;
    
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
