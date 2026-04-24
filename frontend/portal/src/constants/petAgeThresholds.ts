// src/constants/petAgeThresholds.ts

export const AGE_THRESHOLDS = {
    Canine: {
        Baby: 5,    // 0-5 months
        Young: 11,  // 6-11 months
        Adult: 72,  // 1-6 years (72 months)
        // Senior is everything after Adult
    },
    Feline: {
        Baby: 5,
        Young: 11,
        Adult: 108, // 1-9 years (108 months)
    },
    Rabbit: {
        Baby: 3,
        Young: 11,
        Adult: 48,  // 1-4 years (48 months)
    },
    Bird: {
        Baby: 3,
        Young: 11,
        Adult: 84,  // 1-7 years (84 months)
    },
    // Default fallback if species not listed
    Default: {
        Baby: 6,
        Young: 12,
        Adult: 84,
    }
} as const;

export const AGE_GROUPS = {
    BABY: 'Baby',
    YOUNG: 'Young',
    ADULT: 'Adult',
    SENIOR: 'Senior',
    UNDETERMINED: 'Not yet determined'
} as const;
