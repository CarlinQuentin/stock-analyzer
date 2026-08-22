import React, { useEffect, useState } from "react";
import { ExecutiveProfile, ExecutiveCareerHistoryDetail } from "../types";
import { leadershipService } from "../services/leadershipService";

interface ExecutiveCareerModalProps {
  executive: ExecutiveProfile | null;
  companyName: string;
  symbol: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ExecutiveCareerModal: React.FC<ExecutiveCareerModalProps> = ({
  executive,
  companyName,
  symbol,
  isOpen,
  onClose,
}) => {
  const [profile, setProfile] = useState<ExecutiveCareerHistoryDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !executive) {
      setProfile(null);
      setError(null);
      return;
    }

    let isMounted = true;

    async function loadCareerHistory() {
      if (!executive) return;
      setLoading(true);
      setError(null);

      try {
        const data = await leadershipService.fetchExecutiveCareerHistory(
          executive.name,
          companyName,
          symbol,
          executive.title
        );
        if (isMounted) {
          setProfile(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || "Failed to load executive career history.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadCareerHistory();

    return () => {
      isMounted = false;
    };
  }, [isOpen, executive, companyName, symbol]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !executive) return null;

  const getInitials = (name: string): string => {
    if (!name) return "EX";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const roles = profile?.roles || [];
  const education = profile?.education || [];
  const hasRoles = roles.length > 0;

  // Derive source attribution label
  const renderSourceAttribution = () => {
    if (!profile) return null;
    if (profile.source === "pdl") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <span>⚡</span>
          <span>Verified via People Data Labs</span>
        </span>
      );
    }
    if (profile.source === "wikidata") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <span>🌐</span>
          <span>Sourced from Wikidata Public Records</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        <span>📋</span>
        <span>Corporate Officer Disclosures</span>
      </span>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-executive-name"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/60 dark:from-slate-800/90 dark:via-slate-800 dark:to-indigo-950/30 border-b border-slate-200 dark:border-slate-700/80 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            {profile?.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt={executive.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-md flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-800 flex items-center justify-center text-white font-extrabold text-lg uppercase shadow-md flex-shrink-0 border-2 border-white dark:border-slate-700">
                {getInitials(executive.name)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  id="modal-executive-name"
                  className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate"
                >
                  {executive.name}
                </h3>
                {executive.isKeyOfficer && (
                  <span className="px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 rounded-full border border-amber-200 dark:border-amber-700/50">
                    Key Officer
                  </span>
                )}
                {profile?.linkedinUrl && (
                  <a
                    href={profile.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-xs font-semibold hover:underline flex items-center gap-1"
                    title="View LinkedIn Profile"
                  >
                    <span>in</span>
                  </a>
                )}
              </div>
              <p className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 truncate mt-0.5">
                {executive.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {companyName} ({symbol})
                {executive.tenureStartYear ? ` • Since ${executive.tenureStartYear}` : ""}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close career history modal"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Modal Body: Scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {loading ? (
            <div className="space-y-4 py-4 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-6" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="w-3 h-3 rounded-full bg-blue-400 mt-1 flex-shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-6 text-center bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800/40">
              <span className="text-3xl mb-2 block">⚠️</span>
              <h4 className="text-sm font-bold text-red-800 dark:text-red-300">
                Failed to Retrieve Career History
              </h4>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-sm mx-auto">
                {error}
              </p>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  leadershipService
                    .fetchExecutiveCareerHistory(
                      executive.name,
                      companyName,
                      symbol,
                      executive.title,
                      true
                    )
                    .then((d) => {
                      setProfile(d);
                      setLoading(false);
                    })
                    .catch((e) => {
                      setError(e?.message);
                      setLoading(false);
                    });
                }}
                className="mt-3 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Retry
              </button>
            </div>
          ) : !hasRoles ? (
            <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <span className="text-3xl mb-2 block">👔</span>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Career history is not currently available for this executive.
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                No external career timeline was found in enrichment providers. Current corporate title and role details remain verified from financial disclosures.
              </p>
            </div>
          ) : (
            <>
              {/* Executive Summary if available */}
              {profile?.summary && (
                <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                  <h4 className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <span>💡</span>
                    <span>Executive Background</span>
                  </h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {profile.summary}
                  </p>
                </div>
              )}

              {/* Career Timeline */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>💼</span>
                    <span>Career History</span>
                  </h4>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {roles.length} {roles.length === 1 ? "Role" : "Roles"} Documented
                  </span>
                </div>

                <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-blue-500 before:via-slate-300 before:to-slate-200 dark:before:from-blue-500 dark:before:via-slate-700 dark:before:to-slate-800">
                  {roles.map((role, idx) => {
                    const isCurrentRole = role.isCurrent || role.endDate === "Present";
                    return (
                      <div key={idx} className="relative group">
                        {/* Timeline Node */}
                        <div
                          className={`absolute -left-[20px] top-1.5 w-3 h-3 rounded-full border-2 transition-transform duration-200 ${
                            isCurrentRole
                              ? "bg-emerald-500 border-white dark:border-slate-900 ring-4 ring-emerald-100 dark:ring-emerald-950/60 group-hover:scale-125"
                              : "bg-blue-500 border-white dark:border-slate-900 group-hover:scale-125"
                          }`}
                        />

                        {/* Role Card */}
                        <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                            <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                              {role.company}
                            </h5>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-block w-fit ${
                                isCurrentRole
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
                              }`}
                            >
                              {role.startDate ? `${role.startDate} – ` : ""}
                              {role.endDate || "Present"}
                            </span>
                          </div>

                          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                            {role.title}
                          </p>

                          {role.location && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                              <span>📍</span>
                              <span>{role.location}</span>
                            </p>
                          )}

                          {role.description && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed font-normal">
                              {role.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Education Section if available */}
              {education.length > 0 && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <span>🎓</span>
                    <span>Education & Credentials</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {education.map((edu, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50"
                      >
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                          {edu.school}
                        </h5>
                        {edu.degrees && edu.degrees.length > 0 && (
                          <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                            {edu.degrees.join(", ")}
                          </p>
                        )}
                        {edu.majors && edu.majors.length > 0 && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Major: {edu.majors.join(", ")}
                          </p>
                        )}
                        {(edu.startYear || edu.endYear) && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                            {edu.startYear ? `${edu.startYear} – ` : ""}
                            {edu.endYear || ""}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Bar */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>{renderSourceAttribution()}</div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-lg text-xs font-bold transition-colors shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
