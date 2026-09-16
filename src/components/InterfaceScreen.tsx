import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  FolderPlus, FolderOpen, Search, MapPin, 
  Clock, Star, Image as ImageIcon, ChevronRight, 
  CheckCircle2, Cloud, LogOut, Send, Check
} from 'lucide-react';
import { Inspection } from '../types';
import { formatDateOnlyDDMMYYYY } from '../utils/date';

interface InterfaceScreenProps {
  inspections: Inspection[];
  pendingSyncCount: number;
  isOnline: boolean;
  isLoading: boolean;
  onStartInspection: () => void;
  onSelectInspection: (inspection: Inspection) => void;
  onManualSync: () => void;
  onSubmitOfflineInspection?: (inspectionId: string) => Promise<void>;
  onLogout: () => void;
}

export const InterfaceScreen: React.FC<InterfaceScreenProps> = ({
  inspections,
  pendingSyncCount,
  isOnline,
  isLoading,
  onStartInspection,
  onSelectInspection,
  onManualSync,
  onSubmitOfflineInspection,
  onLogout,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'submitted' | 'offline'>('all');
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Filter by search keyword
  const filtered = inspections.filter((item) => {
    const term = searchTerm.toLowerCase();
    return (
      item.location.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      (item.people && item.people.some((p) => p.toLowerCase().includes(term)))
    );
  });

  // Separate into Synced (Submitted Online) vs Offline Saved
  const submittedInspections = filtered.filter((i) => i.isSynced);
  const offlineInspections = filtered.filter((i) => !i.isSynced);

  // Totals before search filter for badges
  const totalSubmitted = inspections.filter((i) => i.isSynced).length;
  const totalOffline = inspections.filter((i) => !i.isSynced).length;

  const handleSubmitSingle = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!onSubmitOfflineInspection) return;
    setSubmittingId(id);
    try {
      await onSubmitOfflineInspection(id);
    } finally {
      setSubmittingId(null);
    }
  };

  const renderInspectionCard = (item: Inspection) => {
    const isOfflineItem = !item.isSynced;
    const displayLocation =
      item.gpsCoords?.areaName ||
      (item.location.includes(', PIN:') ? item.location.split(', PIN:')[0] : item.location);

    const isCurrentSubmitting = submittingId === item.id;

    return (
      <div
        key={item.id}
        onClick={() => onSelectInspection(item)}
        className="p-3 sm:p-3.5 rounded-xl bg-[#1a1d24] hover:bg-[#20252e] border border-[#2e3544] hover:border-[#3e485c] transition-all cursor-pointer flex flex-col gap-2 group"
      >
        {/* Top row: Location Title on left, Status SYMBOL ONLY on right */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <MapPin className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
              {displayLocation}
            </span>
          </div>

          {/* Status Symbol ONLY: Yellow Cloud or Round Green Tick */}
          <div className="shrink-0 flex items-center pl-1" title={isOfflineItem ? 'Saved Offline' : 'Submitted'}>
            {isOfflineItem ? (
              <Cloud className="w-5 h-5 text-amber-400 fill-amber-400/20 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-400/20 shrink-0" />
            )}
          </div>
        </div>

        {/* Bottom row: Metadata chips on left, Submit button & arrow on right */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#262c37]/70 flex-wrap sm:flex-nowrap">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-neutral-400 font-normal">
            {/* Date formatted as dd/mm/yyyy */}
            <span className="flex items-center gap-1 shrink-0 font-medium text-neutral-300">
              <Clock className="w-3 h-3 text-neutral-400" />
              <span>{formatDateOnlyDDMMYYYY(item.createdAt)}</span>
            </span>

            {item.compartments && item.compartments.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-[#282d38] text-neutral-300 border border-[#3a4252] text-[10px] shrink-0 font-normal">
                {item.compartments.length} {item.compartments.length === 1 ? 'item' : 'items'}
              </span>
            )}

            {item.rating > 0 && (
              <span className="flex items-center gap-0.5 text-amber-400 shrink-0 font-normal">
                <Star className="w-3 h-3 fill-amber-400" />
                <span>{item.rating}/5</span>
              </span>
            )}

            {item.images && item.images.length > 0 && (
              <span className="flex items-center gap-1 text-neutral-400 shrink-0 font-normal">
                <ImageIcon className="w-3 h-3 text-neutral-400" />
                <span>{item.images.length}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            {/* Submit button when offline & device is online */}
            {isOfflineItem && isOnline && (
              <button
                type="button"
                onClick={(e) => handleSubmitSingle(e, item.id)}
                disabled={isCurrentSubmitting}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1 transition-all shadow-sm cursor-pointer disabled:opacity-50 min-h-[30px]"
                title="Submit this report to server"
              >
                {isCurrentSubmitting ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    <span>Submit</span>
                  </>
                )}
              </button>
            )}

            <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#1e3a8a] to-[#3b82f6] flex flex-col items-center justify-center p-3 sm:p-6 font-poppins text-white relative">
      {/* Top bar with brand, sync status, and logout */}
      <div className="w-full max-w-[1024px] flex items-center justify-between py-3 sm:py-4 px-1 sm:px-2 mb-2 sm:mb-4 flex-wrap gap-2.5 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden border border-white/30 shadow-md bg-white flex items-center justify-center shrink-0">
            <img
              src="/logo.jpeg"
              alt="Tracport Logo"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-quicksand font-bold tracking-wider text-white leading-tight">
              Tracport
            </h1>
            <p className="text-[10px] sm:text-[11px] text-white/75 tracking-wide font-sans">
              Digital Inspection & File Manager
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 ml-auto sm:ml-0">
          {/* Online / Offline status badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium backdrop-blur-md border shrink-0 ${
              isOnline
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
                : 'bg-rose-500/20 text-rose-200 border-rose-400/30'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            id="logout-btn"
            className="p-1.5 sm:p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors border border-white/10 text-xs flex items-center gap-1.5 shrink-0"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </div>

      {/* Main Container - Clean, solid, responsive dark grey theme */}
      <div className="w-full max-w-[1024px] flex justify-center items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 p-3 sm:p-5 md:p-6 rounded-2xl bg-[#1e222b] border border-[#2e3544] shadow-xl"
        >
          {/* Card 1: Upload Data */}
          <div className="flex flex-col items-center justify-center text-center p-5 sm:p-8 rounded-xl bg-[#242833] border border-[#363e4e] hover:border-[#475266] transition-all duration-200">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#2e3544] flex items-center justify-center text-3xl mb-3">
              📁
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-1.5">
              Upload Data
            </h3>
            <p className="text-xs sm:text-sm text-neutral-300 mb-6 leading-relaxed max-w-xs font-normal">
              Inspect a place — capture GPS, photos, and item evaluation
            </p>
            <button
              onClick={onStartInspection}
              id="start-inspection-btn"
              className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-md transition-all cursor-pointer min-h-[44px]"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Start Inspection</span>
            </button>
          </div>

          {/* Card 2: Submitted & Offline Files (Dedicated Sectioning & Filtering) */}
          <div className="flex flex-col p-3.5 sm:p-5 md:p-6 rounded-xl bg-[#242833] border border-[#363e4e] transition-all duration-200 min-w-0 w-full">
            <div className="flex flex-col items-center text-center mb-3">
              <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-[#2e3544] flex items-center justify-center text-2xl mb-1.5">
                🗂️
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-white mb-0.5">
                Inspection Files
              </h3>
              <p className="text-xs text-neutral-400 font-normal" id="historyStatus">
                {isLoading ? 'Loading...' : `${inspections.length} total reports`}
              </p>
            </div>

            {/* Section Switcher Tabs: All / Round Green Tick / Yellow Cloud */}
            <div className="flex items-center gap-1.5 p-1 bg-[#1a1d24] border border-[#363e4e] rounded-xl mb-3 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-all text-center ${
                  activeTab === 'all'
                    ? 'bg-[#282d38] text-white shadow-sm font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="All reports"
              >
                All ({inspections.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('submitted')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-all text-center flex items-center justify-center gap-1.5 ${
                  activeTab === 'submitted'
                    ? 'bg-[#282d38] text-white shadow-sm font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Submitted online"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>({totalSubmitted})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('offline')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-all text-center flex items-center justify-center gap-1.5 ${
                  activeTab === 'offline'
                    ? 'bg-[#282d38] text-white shadow-sm font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Saved offline"
              >
                <Cloud className="w-4 h-4 text-amber-400 shrink-0" />
                <span>({totalOffline})</span>
              </button>
            </div>

            {/* Quick Search */}
            {inspections.length > 0 && (
              <div className="relative mb-3 w-full">
                <input
                  type="text"
                  placeholder="Search files by location or item..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 text-xs bg-[#1a1d24] border border-[#363e4e] rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 font-normal"
                />
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* File List Container */}
            <div className="flex-1 overflow-y-auto max-h-[320px] sm:max-h-[380px] pr-1 space-y-2 w-full">
              {filtered.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-8 text-center text-neutral-400 text-xs">
                  <FolderOpen className="w-8 h-8 mb-2 opacity-40 text-neutral-400" />
                  <span>
                    {searchTerm ? 'No matching inspections found' : 'Click "Start Inspection" to create a report'}
                  </span>
                </div>
              ) : activeTab === 'offline' && offlineInspections.length === 0 ? (
                <div className="py-8 text-center text-neutral-400 text-xs flex flex-col items-center">
                  <Check className="w-7 h-7 text-emerald-400 mb-2 opacity-80" />
                  <span>No offline drafts. All reports are submitted!</span>
                </div>
              ) : activeTab === 'submitted' && submittedInspections.length === 0 ? (
                <div className="py-8 text-center text-neutral-400 text-xs flex flex-col items-center">
                  <FolderOpen className="w-7 h-7 mb-2 opacity-40 text-neutral-400" />
                  <span>No submitted reports yet.</span>
                </div>
              ) : (
                <>
                  {/* Render Cards based on active tab */}
                  {activeTab === 'all' && filtered.map((item) => renderInspectionCard(item))}
                  {activeTab === 'submitted' && submittedInspections.map((item) => renderInspectionCard(item))}
                  {activeTab === 'offline' && offlineInspections.map((item) => renderInspectionCard(item))}
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
