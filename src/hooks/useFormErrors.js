import { useState } from 'react';

/**
 * A custom hook to handle Laravel validation errors (422 response).
 * It parses the errors object and provides helper methods to display them.
 */
export function useFormErrors() {
  const [errors, setErrors] = useState({});

  /**
   * Set errors from a Laravel validation response.
   * Laravel's 422 response typically looks like:
   * {
   *   "message": "The given data was invalid.",
   *   "errors": {
   *     "field_name": ["The field name is required.", "Another error..."]
   *   }
   * }
   */
  const setLaravelErrors = (response) => {
    if (response && response.errors) {
      // Map Laravel's array of strings to a single string for each field (the first error)
      const formattedErrors = {};
      Object.keys(response.errors).forEach((key) => {
        formattedErrors[key] = response.errors[key][0];
      });
      setErrors(formattedErrors);
    } else if (response && response.message) {
      // Fallback for general error message
      setErrors({ global: response.message });
    }
  };

  const clearErrors = () => setErrors({});

  const getError = (field) => errors[field] || null;

  const hasError = (field) => !!errors[field];

  return {
    errors,
    setLaravelErrors,
    clearErrors,
    getError,
    hasError,
  };
}
