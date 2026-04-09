import { useTheme } from "../context/ThemeContext";

// Sun icon (light mode)
function SunIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-3.5 w-3.5"
        >
            <path d="M12 2.25a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.06 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM21.75 12a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.06 1.06l1.06 1.061ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.166 18.894a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.06 1.06l1.06 1.061ZM6 12a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 1 0-1.5H5.25A.75.75 0 0 1 6 12ZM6.166 5.106a.75.75 0 0 0 1.06 1.06l1.061-1.06a.75.75 0 0 0-1.06-1.06l-1.061 1.06Z" />
        </svg>
    );
}

// Moon icon (dark mode)
function MoonIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-3.5 w-3.5"
        >
            <path
                fillRule="evenodd"
                d="M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 0 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.7-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z"
                clipRule="evenodd"
            />
        </svg>
    );
}

export default function DarkModeToggle() {
    const { isDark, toggleTheme } = useTheme();

    return (
        <button
            type="button"
            role="switch"
            aria-checked={isDark}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
            className={`
        relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full
        border-2 border-transparent p-0.5
        transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2
        focus-visible:ring-blue-500 focus-visible:ring-offset-2
        ${isDark
                    ? "bg-blue-600"
                    : "bg-slate-200 dark:bg-slate-600"
                }
      `}
        >
            {/* Sliding thumb */}
            <span
                className={`
          pointer-events-none relative inline-flex h-5 w-5 transform items-center justify-center
          rounded-full bg-white shadow-md ring-0
          transition-transform duration-300 ease-in-out
          ${isDark ? "translate-x-7" : "translate-x-0"}
        `}
            >
                {/* Sun icon — visible in light mode */}
                <span
                    className={`
            absolute inset-0 flex items-center justify-center
            transition-opacity duration-200
            ${isDark ? "opacity-0" : "opacity-100"}
            text-amber-500
          `}
                >
                    <SunIcon />
                </span>

                {/* Moon icon — visible in dark mode */}
                <span
                    className={`
            absolute inset-0 flex items-center justify-center
            transition-opacity duration-200
            ${isDark ? "opacity-100" : "opacity-0"}
            text-blue-600
          `}
                >
                    <MoonIcon />
                </span>
            </span>
        </button>
    );
}
