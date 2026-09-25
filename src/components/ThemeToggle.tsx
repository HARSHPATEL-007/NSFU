import React from 'react';
import { useTheme, ThemeMode } from '../context/ThemeContext';
import { Sun, Moon, Sparkles } from 'lucide-react';

interface ThemeToggleProps {
  id?: string;
  className?: string;
  showLabels?: boolean;
  variant?: 'segmented' | 'switch';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  id = 'theme-switch-toggle',
  className = '',
  showLabels = true,
  variant = 'segmented',
}) => {
  const { theme, setTheme, toggleTheme } = useTheme();

  if (variant === 'switch') {
    const isDarkOrNight = theme === 'dark' || theme === 'night';
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <button
          type="button"
          id={id}
          role="switch"
          aria-checked={isDarkOrNight}
          onClick={toggleTheme}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
            theme === 'night'
              ? 'bg-purple-900 ring-1 ring-purple-500'
              : theme === 'dark'
              ? 'bg-blue-600'
              : 'bg-stone-300'
          }`}
          title={`Switch Theme (Currently ${theme})`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
              isDarkOrNight ? 'translate-x-5' : 'translate-x-0'
            }`}
          >
            {theme === 'night' ? (
              <Sparkles className="w-3 h-3 text-purple-700" />
            ) : theme === 'dark' ? (
              <Moon className="w-3 h-3 text-blue-700" />
            ) : (
              <Sun className="w-3 h-3 text-amber-500" />
            )}
          </span>
        </button>
        {showLabels && (
          <span className="text-xs font-semibold text-stone-600 dark:text-stone-300 capitalize">
            {theme} Mode
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      id={id}
      className={`inline-flex items-center p-0.5 rounded-lg bg-stone-200/80 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 shadow-2xs select-none ${className}`}
      role="radiogroup"
      aria-label="Theme mode switcher toggle"
    >
      {/* Light / Day Mode Option */}
      <button
        type="button"
        id="btn-theme-light"
        role="radio"
        aria-checked={theme === 'light'}
        onClick={() => setTheme('light')}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
          theme === 'light'
            ? 'bg-white text-amber-800 shadow-xs border border-stone-200'
            : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
        }`}
        title="Light Mode (Institutional Daylight)"
      >
        <Sun className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-amber-500 fill-amber-500/20' : ''}`} />
        {showLabels && <span className="hidden sm:inline">Light</span>}
      </button>

      {/* Dark Mode Option */}
      <button
        type="button"
        id="btn-theme-dark"
        role="radio"
        aria-checked={theme === 'dark'}
        onClick={() => setTheme('dark')}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
          theme === 'dark'
            ? 'bg-stone-900 text-blue-300 shadow-xs border border-stone-700'
            : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
        }`}
        title="Dark Mode (Slate Charcoal)"
      >
        <Moon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-blue-400 fill-blue-400/20' : ''}`} />
        {showLabels && <span className="hidden sm:inline">Dark</span>}
      </button>

      {/* Night Mode Option (Midnight / OLED) */}
      <button
        type="button"
        id="btn-theme-night"
        role="radio"
        aria-checked={theme === 'night'}
        onClick={() => setTheme('night')}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
          theme === 'night'
            ? 'bg-black text-purple-300 shadow-xs border border-purple-900/60 ring-1 ring-purple-500/30'
            : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
        }`}
        title="Night Mode (Pitch Midnight OLED)"
      >
        <Sparkles className={`w-3.5 h-3.5 ${theme === 'night' ? 'text-purple-400 fill-purple-400/20' : ''}`} />
        {showLabels && <span className="hidden sm:inline">Night</span>}
      </button>
    </div>
  );
};
