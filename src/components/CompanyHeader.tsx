import React from "react";
import { CompanyProfile } from "../types";

interface CompanyHeaderProps {
  profile: CompanyProfile;
}

export const CompanyHeader: React.FC<CompanyHeaderProps> = ({ profile }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-slate-900">
              {profile.companyName}
            </h1>
            <span className="text-2xl font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded">
              {profile.symbol}
            </span>
          </div>
          <p className="text-slate-600">
            {profile.sector && <span>{profile.sector}</span>}
            {profile.sector && profile.industry && <span> • </span>}
            {profile.industry && <span>{profile.industry}</span>}
          </p>
        </div>
        {profile.image && (
          <img
            src={profile.image}
            alt={profile.companyName}
            className="w-20 h-20 rounded-lg object-contain ml-4"
          />
        )}
      </div>

      {profile.description && (
        <p className="text-slate-600 text-sm mb-4 line-clamp-3">
          {profile.description}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {profile.website && (
          <a
            href={profile.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Website
          </a>
        )}
        {profile.mktCap && (
          <div>
            <p className="text-slate-500">Market Cap</p>
            <p className="font-semibold text-slate-900">
              ${(profile.mktCap / 1e9).toFixed(1)}B
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
