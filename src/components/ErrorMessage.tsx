import React from "react";

interface ErrorMessageProps {
  title: string;
  message: string;
  details?: string;
  onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title,
  message,
  details,
  onRetry,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-4 transition-colors duration-300">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 border border-transparent dark:border-slate-700/50 transition-colors duration-300">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 dark:bg-red-950/30 rounded-full">
          <svg
            className="w-6 h-6 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-2">
          {title}
        </h2>
        <p className="text-slate-650 dark:text-slate-300 text-center mb-4">{message}</p>
        {details && (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 p-3 rounded font-mono">
            {details}
          </p>
        )}
        <div className="flex gap-3">
          <a
            href="/"
            className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded transition-colors text-center"
          >
            Go Home
          </a>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
