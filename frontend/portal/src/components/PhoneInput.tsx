import { PhoneInput as ReactPhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import clsx from 'clsx';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: any;
  className?: string;
  placeholder?: string;
}

/**
 * A styled international phone input component for Digivet Portal.
 * Wraps react-international-phone with theme-consistent styling.
 */
const PhoneInput: React.FC<PhoneInputProps> = ({ value, onChange, error, className, placeholder = "Enter phone number" }) => {
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
          "!h-12 !w-full !rounded-xl !border !bg-zinc-50 !pl-4 !text-base !text-zinc-700 !placeholder-zinc-400 !transition-all focus:!bg-white focus:!outline-none",
          "dark:!border-dark-border dark:!bg-dark-surface dark:!text-zinc-200 dark:!placeholder-zinc-500 dark:focus:!bg-zinc-800 dark:focus:!border-brand-500",
          error ? "!border-rose-500 focus:!border-rose-600" : "!border-zinc-200 focus:!border-brand-500 dark:!border-dark-border"
        )}
        countrySelectorStyleProps={{
          buttonClassName: clsx(
            "!h-12 !rounded-xl !border !border-r-0 !rounded-r-none !bg-zinc-50 !px-3 !transition-all",
            "dark:!border-dark-border dark:!bg-dark-surface",
            error ? "!border-rose-500" : "!border-zinc-200"
          ),
          dropdownStyleProps: {
            className: "!bg-white dark:!bg-dark-card !border-zinc-200 dark:!border-dark-border !rounded-xl !shadow-xl !mt-2 !max-h-64 !overflow-y-auto slim-scroll",
            listItemClassName: "!text-zinc-700 dark:!text-zinc-300 hover:!bg-zinc-100 dark:hover:!bg-dark-surface",
          }
        }}
      />
      {error && <p className="mt-1 text-[10px] text-rose-500 font-bold uppercase ml-1">{error.message || error}</p>}
      
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
