import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, MapPin, Users, Star, Calendar, 
  Trash2, Image as ImageIcon,
  Crosshair, Clock, CheckCircle2, Cloud, Send
} from 'lucide-react';
import { Inspection, UploadedImage } from '../types';
import { formatDDMMYYYY } from './LiveCameraModal';
import { formatDateTimeDDMMYYYY } from '../utils/date';

interface InspectionModalProps {
  inspection: Inspection | null;
  isOnline?: boolean;
  onSubmitOfflineInspection?: (id: string) => Promise<void>;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export const InspectionModal: React.FC<InspectionModalProps> = ({ 
  inspection, 
  isOnline = true,
  onSubmitOfflineInspection,
  onClose, 
  onDelete 
}) => {
  const [selectedImageObj, setSelectedImageObj] = useState<UploadedImage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Always reset delete confirmation state when viewing an inspection
  useEffect(() => {
    setConfirmDelete(false);
  }, [inspection?.id]);

  // Arrange items by rating: bad rating (lowest) first, good rating (highest) last
  const sortedCompartments = useMemo(() => {
    if (!inspection?.compartments) return [];
    return [...inspection.compartments].sort((a, b) => (a.rating || 0) - (b.rating || 0));
  }, [inspection?.compartments]);

  // Find any images that are not in compartments (e.g. legacy inspections)
  const unassignedImages = useMemo(() => {
    if (!inspection?.images) return [];
    const compartmentImageIds = new Set(
      (inspection.compartments || []).flatMap((c) => (c.images || []).map((img) => img.id))
    );
    return inspection.images.filter((img) => !compartmentImageIds.has(img.id));
  }, [inspection?.images, inspection?.compartments]);

  if (!inspection) return null;

  const handleClose = () => {
    setConfirmDelete(false);
    onClose();
  };

  const handleDelete = () => {
    if (!inspection) return;
    setConfirmDelete(false);
    onDelete(inspection.id);
  };

  const displayArea = inspection.gpsCoords?.areaName || 
    (inspection.location.includes(', PIN:') ? inspection.location.split(', PIN:')[0] : inspection.location);

  const displayPincode = inspection.gpsCoords?.pincode || inspection.pincode || '125001';

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl bg-[#242833] border border-[#363e4e] rounded-2xl shadow-2xl text-neutral-200 overflow-hidden my-auto max-h-[90vh] flex flex-col font-poppins"
        >
          {/* Header */}
          <div className="flex items-start justify-between p-4 sm:p-5 border-b border-[#363e4e] bg-[#242833] sticky top-0 z-10">
            <div className="pr-3 min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-neutral-400 font-normal">
                  Inspection Report
                </span>
                {inspection.isSynced ? (
                  <span className="inline-flex items-center" title="Submitted Online">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </span>
                ) : (
                  <span className="inline-flex items-center" title="Saved Offline">
                    <Cloud className="w-4 h-4 text-amber-400" />
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-white flex items-start gap-2 leading-snug">
                <MapPin className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <span className="break-words">{displayArea}</span>
              </h2>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-[#282d38] transition-colors cursor-pointer shrink-0"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
            {/* Minimalist Summary Strip: Date in dd/mm/yyyy, PIN, GPS, Rating */}
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-neutral-400 font-normal pb-4 border-b border-[#363e4e]">
              <div className="flex items-center gap-1.5 text-neutral-300">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                <span>{formatDateTimeDDMMYYYY(inspection.createdAt)}</span>
              </div>
              <span>•</span>
              <div>
                <span>PIN: </span>
                <span className="text-neutral-200">{displayPincode}</span>
              </div>
              <span>•</span>
              <div>
                <span>GPS: </span>
                <span className="font-mono text-neutral-300">
                  {inspection.gpsCoords
                    ? `${inspection.gpsCoords.latitude.toFixed(5)}, ${inspection.gpsCoords.longitude.toFixed(5)}`
                    : '29.17173, 75.73568'}
                </span>
              </div>
              {inspection.rating > 0 && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1 text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{inspection.rating}/5</span>
                  </div>
                </>
              )}
            </div>

            {/* Inspected Items (Arranged: bad rating first, good rating last, with photos linked to each item) */}
            {sortedCompartments.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-medium text-neutral-400">
                  <span>Inspected Items</span>
                  <span>{sortedCompartments.length} {sortedCompartments.length === 1 ? 'item' : 'items'}</span>
                </div>

                <div className="space-y-3.5">
                  {sortedCompartments.map((comp, idx) => {
                    const compPhotos = comp.images || [];
                    return (
                      <div
                        key={comp.id || idx}
                        className="p-4 rounded-xl bg-[#1b1f27] border border-[#323947] space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-[#282d38] border border-[#3a4252] text-neutral-300 text-[11px] font-medium flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-medium text-white truncate capitalize">
                              {comp.title || `Item #${idx + 1}`}
                            </span>
                          </div>

                          {comp.rating > 0 && (
                            <div className="flex items-center gap-1 text-xs text-amber-400 shrink-0">
                              <Star className="w-3.5 h-3.5 fill-amber-400" />
                              <span>{comp.rating}/5</span>
                            </div>
                          )}
                        </div>

                        {comp.description && (
                          <p className="text-xs sm:text-sm text-neutral-300 font-normal leading-relaxed pl-7 whitespace-pre-wrap">
                            {comp.description}
                          </p>
                        )}

                        {/* Photos Linked Directly to this Item */}
                        {compPhotos.length > 0 && (
                          <div className="pl-7 pt-1 space-y-2">
                            <span className="text-[11px] text-neutral-400 font-medium flex items-center gap-1">
                              <ImageIcon className="w-3 h-3 text-indigo-400" />
                              <span>Photos for this item ({compPhotos.length})</span>
                            </span>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {compPhotos.map((img, pIdx) => (
                                <div
                                  key={img.id}
                                  onClick={() => setSelectedImageObj(img)}
                                  className="group relative rounded-xl overflow-hidden border border-[#2e3544] bg-[#14171e] cursor-pointer hover:border-indigo-500/50 transition-all flex flex-col shadow-sm"
                                >
                                  <div className="relative aspect-video w-full overflow-hidden bg-[#0d0f14]">
                                    <img
                                      src={img.dataUrl}
                                      alt={img.name}
                                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                                    />
                                    <div className="absolute top-2 left-2 bg-[#1b1f27]/85 text-[10px] text-white px-1.5 py-0.5 rounded font-mono font-normal border border-[#323947]">
                                      Photo #{pIdx + 1}
                                    </div>
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-white font-normal">
                                      Click to enlarge
                                    </div>
                                  </div>

                                  {/* Location Details Below Photo */}
                                  <div className="p-2 text-[11px] bg-[#14171e] border-t border-[#262c38] space-y-1 font-normal">
                                    <div className="flex items-start gap-1.5 min-w-0">
                                      <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                                      <p className="text-white truncate text-xs font-medium" title={img.locationName || inspection.gpsCoords?.areaName || displayArea}>
                                        {img.locationName || inspection.gpsCoords?.areaName || displayArea || 'Hisar, Haryana'}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-neutral-400">PIN:</span>
                                      <p className="text-neutral-200 truncate">
                                        {img.pincode || inspection.gpsCoords?.pincode || displayPincode}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <Crosshair className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                      <p className="font-mono text-neutral-300 truncate">
                                        {img.coords
                                          ? `${img.coords.latitude.toFixed(5)}, ${img.coords.longitude.toFixed(5)}`
                                          : inspection.gpsCoords
                                          ? `${inspection.gpsCoords.latitude.toFixed(5)}, ${inspection.gpsCoords.longitude.toFixed(5)}`
                                          : '29.17173, 75.73568'}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                      <p className="font-mono text-neutral-400 truncate">
                                        {img.timestamp || formatDDMMYYYY(inspection.createdAt ? new Date(inspection.createdAt) : undefined)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Fallback for general inspection description */
              inspection.description ? (
                <div>
                  <h3 className="text-xs font-medium text-neutral-400 mb-2">
                    Findings & Observations
                  </h3>
                  <div className="p-3.5 rounded-xl bg-[#1b1f27] border border-[#323947] text-neutral-300 text-sm font-normal whitespace-pre-wrap leading-relaxed">
                    {inspection.description}
                  </div>
                </div>
              ) : null
            )}

            {/* Inspected People */}
            {inspection.people && inspection.people.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-neutral-400 mb-2 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-neutral-400" />
                  <span>Inspected Individuals ({inspection.people.length})</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {inspection.people.map((person, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1.5 rounded-lg bg-[#1b1f27] border border-[#323947] text-xs font-normal text-neutral-200 flex items-center gap-2"
                    >
                      <span className="w-4 h-4 rounded-full bg-[#282d38] text-neutral-300 flex items-center justify-center text-[10px] font-normal">
                        {idx + 1}
                      </span>
                      <span>{person || `Person ${idx + 1}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Additional General Photos (if any exist not linked to compartments) */}
            {unassignedImages.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-neutral-400 mb-2.5 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-neutral-400" />
                  <span>Additional Photos ({unassignedImages.length})</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {unassignedImages.map((img, idx) => (
                    <div
                      key={img.id}
                      onClick={() => setSelectedImageObj(img)}
                      className="group relative rounded-xl overflow-hidden border border-[#2e3544] bg-[#14171e] cursor-pointer hover:border-indigo-500/50 transition-all flex flex-col shadow-sm"
                    >
                      <div className="relative aspect-video w-full overflow-hidden bg-[#0d0f14]">
                        <img
                          src={img.dataUrl}
                          alt={img.name}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                        />
                        <div className="absolute top-2 left-2 bg-[#1b1f27]/85 text-[10px] text-white px-1.5 py-0.5 rounded font-mono font-normal border border-[#323947]">
                          #{idx + 1}
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-white font-normal">
                          Click to enlarge
                        </div>
                      </div>

                      {/* Location Details Below Photo */}
                      <div className="p-2 text-[11px] bg-[#14171e] border-t border-[#262c38] space-y-1 font-normal">
                        <div className="flex items-start gap-1.5 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                          <p className="text-white truncate text-xs font-medium" title={img.locationName || inspection.gpsCoords?.areaName || displayArea}>
                            {img.locationName || inspection.gpsCoords?.areaName || displayArea || 'Hisar, Haryana'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-neutral-400">PIN:</span>
                          <p className="text-neutral-200 truncate">
                            {img.pincode || inspection.gpsCoords?.pincode || displayPincode}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 min-w-0">
                          <Crosshair className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <p className="font-mono text-neutral-300 truncate">
                            {img.coords
                              ? `${img.coords.latitude.toFixed(5)}, ${img.coords.longitude.toFixed(5)}`
                              : inspection.gpsCoords
                              ? `${inspection.gpsCoords.latitude.toFixed(5)}, ${inspection.gpsCoords.longitude.toFixed(5)}`
                              : '29.17173, 75.73568'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 min-w-0">
                          <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <p className="font-mono text-neutral-400 truncate">
                            {img.timestamp || formatDDMMYYYY(inspection.createdAt ? new Date(inspection.createdAt) : undefined)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-[#363e4e] bg-[#242833] flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-[#282d38] hover:bg-[#323946] text-neutral-200 text-xs font-semibold border border-[#3a4252] transition-colors cursor-pointer"
              >
                Close
              </button>

              {/* If saved offline, offer submit option */}
              {!inspection.isSynced && (
                isOnline && onSubmitOfflineInspection ? (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={async () => {
                      setIsSubmitting(true);
                      try {
                        await onSubmitOfflineInspection(inspection.id);
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit Report to Server</span>
                      </>
                    )}
                  </button>
                ) : (
                  <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                    Offline Draft (connect to submit)
                  </span>
                )
              )}
            </div>

            <div>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-400 font-medium">Delete this report?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
                  >
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 rounded-lg bg-[#282d38] hover:bg-[#323946] text-neutral-300 text-xs font-medium border border-[#3a4252] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-rose-400 hover:bg-rose-500/15 text-xs font-semibold border border-rose-500/30 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Report</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Lightbox for single image with details */}
        {selectedImageObj && (
          <div
            className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 cursor-pointer select-none"
            onClick={() => setSelectedImageObj(null)}
          >
            <div 
              className="relative max-w-3xl w-full max-h-[92vh] bg-[#242833] border border-[#363e4e] rounded-2xl overflow-hidden shadow-2xl flex flex-col cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-3.5 px-4 bg-[#1b1f27] border-b border-[#323947] flex items-center justify-between">
                <span className="text-xs font-semibold text-white truncate">
                  {selectedImageObj.name}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedImageObj(null)}
                  className="p-1.5 rounded-lg bg-[#282d38] hover:bg-[#323946] text-neutral-200 border border-[#3a4252] transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Full Image */}
              <div className="flex-1 min-h-0 overflow-auto bg-[#0f1116] flex items-center justify-center p-2">
                <img
                  src={selectedImageObj.dataUrl}
                  alt={selectedImageObj.name}
                  className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-2xl"
                />
              </div>

              {/* Location details separate below enlarged image */}
              <div className="p-3.5 sm:p-4 bg-[#1b1f27] border-t border-[#323947] space-y-1.5 text-xs font-normal">
                {/* Line 1: Actual Area Name */}
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-neutral-400">Area Name</p>
                    <p className="text-white text-xs sm:text-sm font-medium truncate">
                      {selectedImageObj.locationName || inspection.gpsCoords?.areaName || displayArea || 'Hisar, Haryana'}
                    </p>
                  </div>
                </div>

                {/* Line 2: PIN Code */}
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 text-neutral-400 flex items-center justify-center shrink-0 text-xs font-normal mt-0.5">
                    #
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-neutral-400">PIN Code</p>
                    <p className="text-neutral-200 text-xs font-normal">
                      {selectedImageObj.pincode || inspection.gpsCoords?.pincode || displayPincode}
                    </p>
                  </div>
                </div>

                {/* Line 3: Actual Coordinates */}
                <div className="flex items-start gap-2">
                  <Crosshair className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-neutral-400">GPS Coordinates</p>
                    <p className="font-mono text-neutral-300 text-xs font-normal">
                      {selectedImageObj.coords
                        ? `${selectedImageObj.coords.latitude.toFixed(6)}, ${selectedImageObj.coords.longitude.toFixed(6)}`
                        : inspection.gpsCoords
                        ? `${inspection.gpsCoords.latitude.toFixed(6)}, ${inspection.gpsCoords.longitude.toFixed(6)}`
                        : '29.17173, 75.73568'}
                    </p>
                  </div>
                </div>

                {/* Line 4: Date in dd/mm/yyyy */}
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-neutral-400">Date & Time</p>
                    <p className="font-mono text-neutral-300 text-xs font-normal">
                      {selectedImageObj.timestamp || formatDDMMYYYY(inspection.createdAt ? new Date(inspection.createdAt) : undefined)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
};
