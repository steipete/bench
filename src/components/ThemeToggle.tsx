import { useTheme } from '~/contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const themes = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ] as const;

  return (
    <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      {themes.map((themeOption, index) => (
        <button
          key={themeOption.value}
          onClick={() => setTheme(themeOption.value)}
          className={`
            px-3 py-1.5 text-xs font-medium transition-all duration-200 border-r border-gray-200 dark:border-gray-700 last:border-r-0
            ${
              theme === themeOption.value
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750'
            }
          `}
          title={`Switch to ${themeOption.label} mode`}
        >
          {themeOption.label}
        </button>
      ))}
    </div>
  );
}