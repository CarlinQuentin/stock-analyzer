import React from "react";

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = "Loading...",
}) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
        <div className="mb-4">
          <div className="inline-block">
            <div className="w-12 h-12 border-4 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        </div>
        <p className="text-lg text-slate-600">{message}</p>
      </div>
    </div>
  );
};
