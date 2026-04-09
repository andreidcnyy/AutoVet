import { PhoneInput as ReactPhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import clsx from 'clsx';

/**
 * A styled international phone input component for AutoVet.
 * Wraps react-international-phone with theme-consistent styling.
 */
const PhoneInput = ({ value, onChange, error, className, placeholder = "Enter phone number" }) => {
  // Automatically normalize local PH numbers for better initialization if needed
  const normalizedValue = typeof value === 'string' && value.startsWith('09') && value.length === 11 
    ? `+63${value.slice(1)}` 
    : value;

  return (
    <div className={clsx("w-full relative group", className)}>
      <ReactPhoneInput
        defaultCountry="ph"
        value={normalizedValue}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full"
        inputClassName={clsx(
          "!h-12 !w-full !rounded-xl !border !bg-slate-50 !pl-4 !text-base !text-slate-700 !placeholder-slate-400 !transition-all focus:!bg-white focus:!outline-none",
          "dark:!border-dark-border dark:!bg-dark-surface dark:!text-zinc-200 dark:!placeholder-zinc-500 dark:focus:!bg-zinc-800 dark:focus:!border-blue-500",
          error ? "!border-red-400 focus:!border-red-500" : "!border-slate-200 focus:!border-blue-300 dark:!border-dark-border"
        )}
        countrySelectorStyleProps={{
          buttonClassName: clsx(
            "!h-12 !rounded-xl !border !border-r-0 !rounded-r-none !bg-slate-50 !px-3 !transition-all",
            "dark:!border-dark-border dark:!bg-dark-surface",
            error ? "!border-red-400" : "!border-slate-200"
          ),
          dropdownClassName: "!bg-white dark:!bg-dark-card !border-slate-200 dark:!border-dark-border !rounded-xl !shadow-xl !mt-2 !max-h-64 !overflow-y-auto slim-scroll",
          dropdownItemClassName: "!text-slate-700 dark:!text-zinc-300 hover:!bg-slate-100 dark:hover:!bg-dark-surface",
          dropdownItemActiveClassName: "!bg-blue-50 dark:!bg-blue-900/20 !text-blue-600 dark:!text-blue-400",
          searchStyleProps: {
            className: "dark:!bg-dark-surface dark:!border-dark-border dark:!text-zinc-200",
            placeholderClassName: "dark:!text-zinc-500"
          }
        }}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error.message || error}</p>}
      
      <style>{`
        .react-international-phone-input-container {
          width: 100% !important;
          display: flex !important;
          align-items: center !important;
        }
        .react-international-phone-input {
          flex: 1 !important;
          border-top-left-radius: 0 !important;
          border-bottom-left-radius: 0 !important;
          margin-left: -1px !important;
        }
        /* Custom scrollbar for dropdown */
        .slim-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .slim-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .slim-scroll::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.5);
          border-radius: 10px;
        }
        .dark .slim-scroll::-webkit-scrollbar-thumb {
          background: rgba(82, 82, 91, 0.5);
        }
      `}</style>
    </div>
  );
};

export default PhoneInput;
