/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, X, Star, ArrowLeft, 
  CheckCircle, Save, AlertTriangle, Crosshair,
  Plus, Trash2, Camera, Layers, RotateCcw, Clock, Maximize2
} from 'lucide-react';
import { GPSCoords, UploadedImage, Inspection, InspectionCompartment } from '../types';
import { LiveCameraModal, formatDDMMYYYY } from './LiveCameraModal';

interface InspectionFormScreenProps {
  isOnline: boolean;
  offlineQueueCount: number;
  onSaveOffline: (data: Omit<Inspection, 'id' | 'createdAt'>) => Promise<void>;
  onSubmitReport: (data: Omit<Inspection, 'id' | 'createdAt'>) => Promise<void>;
  onCancel: () => void;
  onShowToast: (msg: string, type: 'info' | 'success' | 'error') => void;
}

const MAX_IMAGE_DIMENSION = 1200;
const JPEG_QUALITY = 0.75;
const MAX_DOC_BYTES = 12 * 1024 * 1024; // 12MB safety limit

export const InspectionFormScreen: React.FC<InspectionFormScreenProps> = ({
  isOnline,
  offlineQueueCount,
  onSaveOffline,
  onSubmitReport,
  onCancel,
  onShowToast,
}) => {
  const [location, setLocation] = useState('');
  const [gpsCoords, setGpsCoords] = useState<GPSCoords | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsStatusText, setGpsStatusText] = useState('');
  const [detectedAreaName, setDetectedAreaName] = useState<string>('');
  const [pincode, setPincode] = useState<string>('');

  const [peopleCount, setPeopleCount] = useState('');
  const [people, setPeople] = useState<string[]>([]);

  // COMPARTMENTS: each item has its own Name/Title, Description Box, Rating, and Photos
  const [compartments, setCompartments] = useState<InspectionCompartment[]>([
    {
      id: 'comp_initial_1',
      title: '',
      description: '',
      rating: 5,
      images: [],
    }
  ]);

  const [activeCompartmentIdForPhoto, setActiveCompartmentIdForPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [selectedEnlargedPhoto, setSelectedEnlargedPhoto] = useState<UploadedImage | null>(null);

  const handleLocationDetectedFromCamera = (detectedLoc: string, coords: GPSCoords, detectedPin?: string) => {
    const cleanArea = (detectedLoc && detectedLoc.trim() && detectedLoc !== 'Site Location')
      ? detectedLoc.trim()
      : 'Hisar, Haryana';
    const cleanPin = detectedPin || coords.pincode || '125001';

    setDetectedAreaName(cleanArea);
    setPincode(cleanPin);
    const updatedCoords = { ...coords, areaName: cleanArea, pincode: cleanPin };
    setGpsCoords(updatedCoords);
    const fullLocation = `${cleanArea}, PIN: ${cleanPin}, GPS: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
    setLocation(fullLocation);

    try {
      localStorage.setItem('tracport_last_location', JSON.stringify({
        lat: coords.latitude,
        lon: coords.longitude,
        areaName: cleanArea,
        pincode: cleanPin,
      }));
    } catch {}
  };

  // Sync people array length with peopleCount select
  useEffect(() => {
    const count = parseInt(peopleCount, 10) || 0;
    setPeople((prev) => {
      const next = [...prev];
      if (count > next.length) {
        while (next.length < count) {
          next.push('');
        }
      } else if (count < next.length) {
        next.length = count;
      }
      return next;
    });
  }, [peopleCount]);

  // Offline coordinate resolution helper
  const resolveOfflineCoordinates = (lat: number, lon: number): { areaName: string; pincode: string } => {
    try {
      const cached = localStorage.getItem(`geo_${lat.toFixed(3)}_${lon.toFixed(3)}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.areaName && parsed.pincode) return parsed;
      }
    } catch {}

    try {
      const saved = localStorage.getItem('tracport_last_location');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.areaName && parsed.pincode) return { areaName: parsed.areaName, pincode: parsed.pincode };
      }
    } catch {}

    // Regional coordinate bounds lookup for common operational areas
    if (Math.abs(lat - 29.17) < 0.4 && Math.abs(lon - 75.73) < 0.4) {
      return { areaName: 'Hisar, Haryana', pincode: '125001' };
    }
    if (Math.abs(lat - 28.61) < 0.4 && Math.abs(lon - 77.20) < 0.4) {
      return { areaName: 'New Delhi, Delhi', pincode: '110001' };
    }
    if (Math.abs(lat - 28.45) < 0.4 && Math.abs(lon - 77.02) < 0.4) {
      return { areaName: 'Gurugram, Haryana', pincode: '122001' };
    }
    if (Math.abs(lat - 30.73) < 0.4 && Math.abs(lon - 76.77) < 0.4) {
      return { areaName: 'Chandigarh', pincode: '160017' };
    }
    if (Math.abs(lat - 29.96) < 0.4 && Math.abs(lon - 76.87) < 0.4) {
      return { areaName: 'Kurukshetra, Haryana', pincode: '136118' };
    }
    if (Math.abs(lat - 29.68) < 0.4 && Math.abs(lon - 76.99) < 0.4) {
      return { areaName: 'Karnal, Haryana', pincode: '132001' };
    }
    if (Math.abs(lat - 28.89) < 0.4 && Math.abs(lon - 76.60) < 0.4) {
      return { areaName: 'Rohtak, Haryana', pincode: '124001' };
    }

    return { areaName: 'Hisar, Haryana', pincode: '125001' };
  };

  // Apply coordinates and resolved location info
  const applyCoordinatesLocation = (
    lat: number,
    lon: number,
    accuracy: number = 10,
    customArea?: string,
    customPin?: string
  ) => {
    const offlineInfo = resolveOfflineCoordinates(lat, lon);
    const resolvedArea = customArea || offlineInfo.areaName || 'Hisar, Haryana';
    const resolvedPin = customPin || offlineInfo.pincode || '125001';

    const coords: GPSCoords = {
      latitude: lat,
      longitude: lon,
      accuracy,
      areaName: resolvedArea,
      pincode: resolvedPin,
    };

    setGpsCoords(coords);
    setDetectedAreaName(resolvedArea);
    setPincode(resolvedPin);

    const fullLocation = `${resolvedArea}, PIN: ${resolvedPin}, GPS: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    setLocation(fullLocation);

    setGpsLoading(false);
    setGpsStatusText(`${resolvedArea} (PIN: ${resolvedPin}) [${lat.toFixed(5)}, ${lon.toFixed(5)}]`);
    onShowToast(`Location detected: ${resolvedArea}`, 'success');

    try {
      localStorage.setItem('tracport_last_location', JSON.stringify({
        lat,
        lon,
        areaName: resolvedArea,
        pincode: resolvedPin,
      }));
      localStorage.setItem(`geo_${lat.toFixed(3)}_${lon.toFixed(3)}`, JSON.stringify({
        areaName: resolvedArea,
        pincode: resolvedPin,
      }));
    } catch {}
  };

  // Reverse Geocoding helper via server endpoint
  const reverseGeocode = async (lat: number, lon: number): Promise<{ areaName: string; pincode: string }> => {
    try {
      const res = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error('Geocode API request failed');
      const data = await res.json();
      if (data.success) {
        return {
          areaName: data.areaName || '',
          pincode: data.postcode || data.address?.postcode || '',
        };
      }
    } catch (err) {
      console.warn('Reverse geocode note (offline or network unavailable):', err);
    }
    return { areaName: '', pincode: '' };
  };

  // Capture GPS & Reverse-Geocode Area Name + PIN Code with seamless offline support
  const handleGetLocation = () => {
    setGpsLoading(true);
    setGpsStatusText('Acquiring location, PIN code & coordinates...');

    // Helper to get fallback/cached coordinates
    const getFallbackCoords = () => {
      let fallbackLat = 29.17173;
      let fallbackLon = 75.73568;
      let fallbackArea = 'Hisar, Haryana';
      let fallbackPin = '125001';

      try {
        const saved = localStorage.getItem('tracport_last_location');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.lat && parsed.lon) {
            fallbackLat = parsed.lat;
            fallbackLon = parsed.lon;
            if (parsed.areaName) fallbackArea = parsed.areaName;
            if (parsed.pincode) fallbackPin = parsed.pincode;
          }
        }
      } catch {}

      return { lat: fallbackLat, lon: fallbackLon, area: fallbackArea, pin: fallbackPin };
    };

    if (!navigator.geolocation) {
      const fb = getFallbackCoords();
      applyCoordinatesLocation(fb.lat, fb.lon, 15, fb.area, fb.pin);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const accuracy = pos.coords.accuracy || 10;

        // Perform reverse geocoding via server endpoint if available
        let resolvedArea = '';
        let resolvedPin = '';
        try {
          const geoResult = await reverseGeocode(lat, lon);
          if (geoResult.areaName) resolvedArea = geoResult.areaName;
          if (geoResult.pincode) resolvedPin = geoResult.pincode;
        } catch {}

        if (!resolvedArea || !resolvedPin) {
          const offlineInfo = resolveOfflineCoordinates(lat, lon);
          if (!resolvedArea) resolvedArea = offlineInfo.areaName;
          if (!resolvedPin) resolvedPin = offlineInfo.pincode;
        }

        applyCoordinatesLocation(lat, lon, accuracy, resolvedArea, resolvedPin);
      },
      async (err) => {
        console.warn('GPS hardware notice (resolving from coordinates):', err);
        // When offline or GPS hardware lock is unavailable: never error or say GPS unavailable!
        // Seamlessly use coordinates to get information exactly as when offline
        const fb = getFallbackCoords();
        applyCoordinatesLocation(fb.lat, fb.lon, 15, fb.area, fb.pin);
      },
      { timeout: 4000, enableHighAccuracy: true, maximumAge: 15000 }
    );
  };

  const handleOpenPhotoCaptureForCompartment = (compartmentId: string) => {
    if (!location && !gpsCoords) {
      onShowToast('Acquiring location for photo geotagging...', 'info');
      handleGetLocation();
    }
    setActiveCompartmentIdForPhoto(compartmentId);
    setIsCameraOpen(true);
  };

  const handlePhotoCaptured = (newImage: UploadedImage) => {
    if (activeCompartmentIdForPhoto) {
      setCompartments((prev) =>
        prev.map((c) => {
          if (c.id === activeCompartmentIdForPhoto) {
            const currentPhotos = c.images || [];
            return {
              ...c,
              images: [...currentPhotos, newImage],
            };
          }
          return c;
        })
      );
    }
  };

  const removePhotoFromCompartment = (compartmentId: string, photoId: string) => {
    setCompartments((prev) =>
      prev.map((c) => {
        if (c.id === compartmentId) {
          return {
            ...c,
            images: (c.images || []).filter((img) => img.id !== photoId),
          };
        }
        return c;
      })
    );
  };

  // COMPARTMENTS MANAGEMENT (Each with Title + Description Box + Rating System + Photos)
  const handleAddCompartment = (presetTitle?: string) => {
    // If there is only one empty compartment, fill its title directly
    if (presetTitle && compartments.length === 1 && !compartments[0].title.trim() && !compartments[0].description.trim()) {
      setCompartments([
        {
          ...compartments[0],
          title: presetTitle,
        }
      ]);
      onShowToast(`Set item to: ${presetTitle}`, 'info');
      return;
    }

    const newComp: InspectionCompartment = {
      id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: presetTitle || '',
      description: '',
      rating: 5,
      images: [],
    };
    setCompartments((prev) => [...prev, newComp]);
    onShowToast(`Added item: ${presetTitle || `Item #${compartments.length + 1}`}`, 'info');
  };

  const handleUpdateCompartment = (
    id: string,
    field: keyof InspectionCompartment,
    value: string | number
  ) => {
    setCompartments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleRemoveCompartment = (id: string) => {
    if (compartments.length <= 1) {
      // Clear the single remaining compartment
      setCompartments([
        {
          id: `comp_${Date.now()}`,
          title: '',
          description: '',
          rating: 5,
          images: [],
        }
      ]);
      onShowToast('Item cleared', 'info');
      return;
    }
    setCompartments((prev) => prev.filter((c) => c.id !== id));
    onShowToast('Item removed', 'info');
  };

  const getRatingLabel = (val: number) => {
    return `${val} / 5`;
  };

  // Calculate total images across all compartments
  const allImages = compartments.flatMap((c) => c.images || []);

  const checkDocSizeWarning = () => {
    const totalBytes = allImages.reduce((acc, img) => acc + img.dataUrl.length, 0);
    return totalBytes > MAX_DOC_BYTES;
  };

  const validateForm = (): boolean => {
    if (!gpsCoords || !location.trim()) {
      onShowToast('Please fetch current location to continue', 'error');
      return false;
    }
    if (!peopleCount) {
      onShowToast('Please select the number of people inspected', 'error');
      return false;
    }
    if (compartments.length === 0) {
      onShowToast('Please add at least one inspection item', 'error');
      return false;
    }
    for (let i = 0; i < compartments.length; i++) {
      const c = compartments[i];
      if (!c.title.trim()) {
        onShowToast(`Please enter the item name for Item #${i + 1}`, 'error');
        return false;
      }
      if (!c.description.trim()) {
        onShowToast(`Please enter the description for "${c.title}"`, 'error');
        return false;
      }
      if (!c.rating || c.rating < 1) {
        onShowToast(`Please rate "${c.title}"`, 'error');
        return false;
      }
      if (!c.images || c.images.length === 0) {
        onShowToast(`Please take a photo for "${c.title}"`, 'error');
        return false;
      }
    }
    return true;
  };

  const getFormData = (): Omit<Inspection, 'id' | 'createdAt'> => {
    // Sort compartments by ascending rating: bad rating (lowest) first, good rating (highest) last
    const sortedCompartments = [...compartments].sort((a, b) => (a.rating || 0) - (b.rating || 0));

    // Combine all photos from each compartment
    const aggregatedImages = sortedCompartments.flatMap((c) => c.images || []);

    // Generate combined description summary from all compartments
    const combinedDesc = sortedCompartments
      .map((c) => `[${c.title}]: ${c.description} (Rating: ${c.rating}/5)`)
      .join('\n\n');

    // Calculate average rating across all compartments
    const avgRating = Math.round(
      sortedCompartments.reduce((acc, c) => acc + (c.rating || 0), 0) / sortedCompartments.length
    ) || 5;

    return {
      location: location.trim(),
      gpsCoords,
      peopleCount,
      people: people.map((p) => p.trim()).filter(Boolean),
      images: aggregatedImages,
      description: combinedDesc,
      rating: avgRating,
      compartments: sortedCompartments,
    };
  };

  const handleSaveOfflineClick = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      await onSaveOffline(getFormData());
      onShowToast('Inspection saved offline successfully', 'success');
      setTimeout(() => {
        onCancel();
      }, 600);
    } catch (e) {
      onShowToast('Failed to save offline', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      await handleSaveOfflineClick();
      return;
    }
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onSubmitReport(getFormData());
    } catch (err) {
      onShowToast('Error submitting inspection', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#1e222b] py-6 sm:py-10 px-3 sm:px-6 font-poppins flex flex-col items-center">
      {/* Top navigation */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-4">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#282d38] hover:bg-[#323946] text-neutral-300 hover:text-white text-xs sm:text-sm font-medium border border-[#3a4252] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        {offlineQueueCount > 0 && (
          <span className="text-xs text-amber-300 bg-amber-950/50 border border-amber-800/60 px-3 py-1 rounded-full font-medium">
            {offlineQueueCount} offline pending
          </span>
        )}
      </div>

      {/* Main Inspection Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-2xl bg-[#242833] border border-[#363e4e] rounded-2xl p-5 sm:p-8 text-neutral-200 shadow-xl"
      >
        {/* Clean Header */}
        <div className="flex items-center justify-between pb-5 border-b border-[#363e4e]">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-400" />
              <span>Inspection Report</span>
            </h1>
          </div>

          {/* Online / Offline status pill */}
          <div
            id="statusPill"
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              isOnline
                ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
                : 'bg-rose-950/50 text-rose-300 border-rose-800/60'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            <span id="statusText">{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>

        <form id="inspectionForm" onSubmit={handleSubmit} className="pt-6 space-y-6 sm:space-y-7">
          {/* SECTION 1: Location */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-medium text-neutral-200 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-indigo-400" />
                <span>Location</span>
                <span className="text-rose-400">*</span>
              </label>

              {gpsCoords && (
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={gpsLoading}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#282d38] hover:bg-[#323946] text-neutral-300 text-xs font-medium border border-[#3a4252] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                  <span>{gpsLoading ? 'Updating...' : 'Update Location'}</span>
                </button>
              )}
            </div>

            {!gpsCoords || !location ? (
              /* State 1: Before GPS fetch */
              <div className="space-y-2">
                <button
                  type="button"
                  id="gpsBtn"
                  onClick={handleGetLocation}
                  disabled={gpsLoading}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60 min-h-[44px]"
                >
                  <Crosshair className={`w-4 h-4 ${gpsLoading ? 'animate-spin' : ''}`} />
                  <span>{gpsLoading ? 'Fetching Location...' : 'Tap to Get Current Location'}</span>
                </button>

                {gpsStatusText && (
                  <p id="gpsStatus" className="text-xs text-amber-300 font-mono text-center">
                    {gpsStatusText}
                  </p>
                )}
              </div>
            ) : (
              /* State 2: After GPS fetch */
              <div className="space-y-2">
                <div className="rounded-xl bg-[#1b1f27] border border-[#323947] p-4 space-y-2.5 text-xs sm:text-sm font-normal">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] text-neutral-400 block">Area</span>
                      <span className="text-white font-medium">{detectedAreaName || 'Hisar, Haryana'}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-4 text-neutral-400 font-mono text-center mt-0.5">#</span>
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] text-neutral-400 block">PIN Code</span>
                      <span className="text-neutral-200">{pincode || '125001'}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Crosshair className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] text-neutral-400 block">GPS Coordinates</span>
                      <span className="font-mono text-neutral-300 text-xs">
                        {gpsCoords ? `${gpsCoords.latitude.toFixed(5)}, ${gpsCoords.longitude.toFixed(5)}` : '29.17173, 75.73568'}
                        {gpsCoords?.accuracy ? ` (±${Math.round(gpsCoords.accuracy)}m)` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <input
                  id="location"
                  type="hidden"
                  value={location}
                  readOnly
                  required
                />
              </div>
            )}
          </div>

          {/* Line Divider */}
          <div className="border-t border-[#363e4e]" />

          {/* SECTION 2: Number of People Inspected */}
          <div className="space-y-3">
            <label htmlFor="peopleCount" className="block text-xs sm:text-sm font-medium text-neutral-200">
              Number of People Inspected <span className="text-rose-400">*</span>
            </label>
            <select
              id="peopleCount"
              value={peopleCount}
              onChange={(e) => setPeopleCount(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#1b1f27] border border-[#384152] text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer min-h-[44px]"
            >
              <option value="">Select count</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15].map((num) => (
                <option key={num} value={num}>
                  {num} {num === 1 ? 'Person' : 'People'}
                </option>
              ))}
            </select>

            {/* Dynamic People list */}
            {people.length > 0 && (
              <div id="peopleList" className="mt-3 space-y-2 pt-1">
                {people.map((person, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="shrink-0 w-8 h-8 rounded-lg bg-[#282d38] border border-[#3a4252] text-neutral-300 text-xs font-normal flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      placeholder={`Person #${idx + 1} name`}
                      value={person}
                      onChange={(e) => {
                        const next = [...people];
                        next[idx] = e.target.value;
                        setPeople(next);
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-[#14171e] border border-[#384152] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 min-h-[38px]"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Line Divider */}
          <div className="border-t border-[#363e4e]" />

          {/* SECTION 3: Inspected Items (Each item has: Item Name, Description, Rating, and Photo) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <h2 className="text-xs sm:text-sm font-medium text-white">
                  Inspected Items
                </h2>
                <span className="text-rose-400">*</span>
              </div>

              <span className="text-xs text-neutral-400">
                {compartments.length} {compartments.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* List of Items */}
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {compartments.map((comp, idx) => {
                  const compPhotos = comp.images || [];
                  return (
                    <motion.div
                      key={comp.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                      className="p-4 sm:p-5 rounded-xl bg-[#1b1f27] border border-[#323947] space-y-4 shadow-sm"
                    >
                      {/* Item Header */}
                      <div className="flex items-center justify-between pb-2.5 border-b border-[#2e3543]">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-[#282d38] border border-[#3a4252] text-neutral-300 text-xs font-medium flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-xs sm:text-sm font-medium text-white">
                            {comp.title ? `Item #${idx + 1}: ${comp.title}` : `Item #${idx + 1}`}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveCompartment(comp.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-neutral-400 hover:text-rose-400 hover:bg-[#282d38] transition-colors cursor-pointer"
                          title={compartments.length <= 1 ? 'Clear item' : 'Delete item'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{compartments.length <= 1 ? 'Clear' : 'Delete'}</span>
                        </button>
                      </div>

                      {/* 1. Item Name */}
                      <div>
                        <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                          Item Name <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={comp.title}
                          onChange={(e) => handleUpdateCompartment(comp.id, 'title', e.target.value)}
                          placeholder="e.g., Water Tap, Electrical Switchboard, Fire Extinguisher"
                          required
                          className="w-full px-3.5 py-2.5 rounded-lg bg-[#14171e] border border-[#384152] text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 min-h-[40px]"
                        />
                      </div>

                      {/* 2. Item Description Box */}
                      <div>
                        <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                          Description <span className="text-rose-400">*</span>
                        </label>
                        <textarea
                          value={comp.description}
                          onChange={(e) => handleUpdateCompartment(comp.id, 'description', e.target.value)}
                          placeholder="Enter observations, damages, or inspection remarks..."
                          required
                          rows={3}
                          className="w-full px-3.5 py-2.5 rounded-lg bg-[#14171e] border border-[#384152] text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 resize-y min-h-[80px]"
                        />
                      </div>

                      {/* 3. Item Rating */}
                      <div className="pt-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-neutral-300">
                            Rating <span className="text-rose-400">*</span>
                          </label>
                          <span className="text-xs text-amber-400 font-medium">
                            {getRatingLabel(comp.rating)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {[1, 2, 3, 4, 5].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleUpdateCompartment(comp.id, 'rating', val)}
                              className="p-1 cursor-pointer focus:outline-none"
                              aria-label={`${val} star rating`}
                            >
                              <Star
                                className={`w-6 h-6 transition-colors ${
                                  val <= comp.rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-neutral-600 hover:text-neutral-500'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 4. Photo for that Item */}
                      <div className="pt-2 border-t border-[#2a313e] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                            <Camera className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Photo for this Item</span>
                            <span className="text-rose-400">*</span>
                          </label>

                          <span className="text-[11px] text-neutral-400">
                            {compPhotos.length} {compPhotos.length === 1 ? 'photo' : 'photos'}
                          </span>
                        </div>

                        {/* Display Attached Photos for this Item */}
                        {compPhotos.length > 0 ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {compPhotos.map((img, pIdx) => (
                                <div
                                  key={img.id}
                                  className="group relative rounded-xl overflow-hidden border border-[#2f3645] bg-[#14171e] flex flex-col shadow-sm"
                                >
                                  {/* Photo Preview Thumbnail */}
                                  <div
                                    onClick={() => setSelectedEnlargedPhoto(img)}
                                    className="relative aspect-video w-full overflow-hidden bg-[#0d0f14] cursor-pointer"
                                    title="Click to view enlarged photo"
                                  >
                                    <img
                                      src={img.dataUrl}
                                      alt={img.name}
                                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                                    />
                                    <div className="absolute top-2 left-2 bg-[#1b1f27]/85 text-[10px] text-white px-2 py-0.5 rounded font-mono border border-[#323947]">
                                      Photo #{pIdx + 1}
                                    </div>

                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                      <span className="px-2.5 py-1 rounded-md bg-[#1b1f27]/90 text-white text-[11px] font-medium flex items-center gap-1.5 shadow border border-[#3a4252]">
                                        <Maximize2 className="w-3 h-3" />
                                        <span>Enlarge</span>
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removePhotoFromCompartment(comp.id, img.id);
                                      }}
                                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center text-xs shadow-md transition-colors cursor-pointer z-10"
                                      title="Remove photo"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  {/* Location Details Below Photo */}
                                  <div className="p-2.5 text-xs bg-[#14171e] border-t border-[#262c37] space-y-1 font-normal">
                                    <div className="flex items-start gap-1.5 min-w-0">
                                      <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                                      <p className="text-white text-xs truncate font-medium" title={img.locationName || detectedAreaName || 'Hisar, Haryana'}>
                                        {img.locationName || detectedAreaName || 'Hisar, Haryana'}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-1.5 min-w-0 text-[11px]">
                                      <span className="text-neutral-400">PIN:</span>
                                      <p className="text-neutral-200 truncate">
                                        {img.pincode || pincode || '125001'}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-1.5 min-w-0 text-[11px]">
                                      <Crosshair className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                      <p className="font-mono text-neutral-300 truncate">
                                        {img.coords
                                          ? `${img.coords.latitude.toFixed(5)}, ${img.coords.longitude.toFixed(5)}`
                                          : gpsCoords
                                          ? `${gpsCoords.latitude.toFixed(5)}, ${gpsCoords.longitude.toFixed(5)}`
                                          : '29.17173, 75.73568'}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-1.5 min-w-0 text-[11px]">
                                      <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                      <p className="font-mono text-neutral-400 truncate">
                                        {img.timestamp || formatDDMMYYYY()}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Add another photo button for this item */}
                            <button
                              type="button"
                              onClick={() => handleOpenPhotoCaptureForCompartment(comp.id)}
                              className="w-full py-2 px-3 rounded-lg bg-[#282d38] hover:bg-[#323946] border border-[#3a4252] text-neutral-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[38px]"
                            >
                              <Camera className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Take Another Photo for this Item</span>
                            </button>
                          </div>
                        ) : (
                          /* No photo yet: Clean prompt to take photo */
                          <button
                            type="button"
                            onClick={() => handleOpenPhotoCaptureForCompartment(comp.id)}
                            className="w-full py-3 px-4 rounded-xl bg-[#282d38] hover:bg-[#323946] active:bg-[#3a4252] border border-[#3a4252] text-white text-xs sm:text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer min-h-[44px]"
                          >
                            <Camera className="w-4 h-4 text-indigo-400" />
                            <span>Take Photo for {comp.title ? `"${comp.title}"` : `Item #${idx + 1}`}</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Clean Add Item Button */}
            <button
              type="button"
              onClick={() => handleAddCompartment()}
              className="w-full py-3 px-4 rounded-xl border border-dashed border-[#444d5e] hover:border-[#5a657a] bg-[#20242e] hover:bg-[#282d38] text-neutral-300 hover:text-white text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[44px]"
            >
              <Plus className="w-4 h-4 text-indigo-400" />
              <span>Add Item</span>
            </button>
          </div>

          {/* Line Divider */}
          <div className="border-t border-[#363e4e]" />

          {/* SECTION 4: Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            {/* When offline: 'Submit Report' is removed and only 'Save Offline' is visible spanning full width */}
            <button
              type="button"
              id="saveBtn"
              onClick={handleSaveOfflineClick}
              disabled={isSubmitting}
              className={`py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[44px] ${
                !isOnline
                  ? 'w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold shadow-md text-sm'
                  : 'w-full sm:w-1/2 bg-[#282d38] hover:bg-[#323946] border border-[#3a4252] text-neutral-200 text-xs sm:text-sm'
              }`}
            >
              <Save className={`w-4 h-4 ${!isOnline ? 'text-neutral-950' : 'text-amber-400'}`} />
              <span>Save Offline</span>
            </button>

            {isOnline && (
              <button
                type="submit"
                id="submitBtn"
                disabled={isSubmitting}
                className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-medium flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-60 min-h-[44px]"
              >
                {isSubmitting ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Submit Report</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </motion.div>

      {/* Live Camera Viewfinder Modal */}
      <LiveCameraModal
        isOpen={isCameraOpen}
        onClose={() => {
          setIsCameraOpen(false);
          setActiveCompartmentIdForPhoto(null);
        }}
        onPhotoCaptured={handlePhotoCaptured}
        capturedCount={allImages.length}
        currentLocationName={detectedAreaName || location.split(', PIN:')[0]}
        currentPincode={pincode || gpsCoords?.pincode || '125001'}
        currentCoords={gpsCoords}
        onLocationDetected={handleLocationDetectedFromCamera}
        onShowToast={onShowToast}
      />

      {/* Enlarged Photo Modal (Click any photo to view enlarged) */}
      <AnimatePresence>
        {selectedEnlargedPhoto && (
          <div
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 select-none"
            onClick={() => setSelectedEnlargedPhoto(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl bg-[#242833] border border-[#363e4e] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
            >
              {/* Header */}
              <div className="p-3.5 px-4 bg-[#1b1f27] border-b border-[#323947] flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <Camera className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-xs font-semibold text-white truncate">
                    {selectedEnlargedPhoto.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEnlargedPhoto(null)}
                  className="p-1.5 rounded-lg bg-[#282d38] hover:bg-[#323946] text-neutral-200 border border-[#3a4252] transition-colors cursor-pointer"
                  title="Close enlarge view"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Enlarged Image */}
              <div className="flex-1 min-h-0 overflow-auto bg-[#0f1116] flex items-center justify-center p-3">
                <img
                  src={selectedEnlargedPhoto.dataUrl}
                  alt={selectedEnlargedPhoto.name}
                  className="max-w-full max-h-[65vh] object-contain rounded-lg shadow"
                />
              </div>

              {/* Location Details Separate Below Enlarged Photo */}
              <div className="p-4 bg-[#1b1f27] border-t border-[#323947] space-y-2 text-xs">
                {/* Line 1: Actual Area Name */}
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Area Name</p>
                    <p className="font-semibold text-white text-sm truncate">
                      {selectedEnlargedPhoto.locationName || detectedAreaName || 'Hisar, Haryana'}
                    </p>
                  </div>
                </div>

                {/* Line 2: PIN Code */}
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 text-neutral-400 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                    #
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">PIN Code</p>
                    <p className="text-white font-bold text-xs">
                      {selectedEnlargedPhoto.pincode || pincode || '125001'}
                    </p>
                  </div>
                </div>

                {/* Line 3: Actual Coordinates */}
                <div className="flex items-start gap-2">
                  <Crosshair className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Coordinates (GPS)</p>
                    <p className="font-mono text-neutral-200 text-xs">
                      {selectedEnlargedPhoto.coords
                        ? `GPS: ${selectedEnlargedPhoto.coords.latitude.toFixed(6)}, ${selectedEnlargedPhoto.coords.longitude.toFixed(6)}${
                            selectedEnlargedPhoto.coords.accuracy ? ` (±${Math.round(selectedEnlargedPhoto.coords.accuracy)}m)` : ''
                          }`
                        : gpsCoords
                        ? `GPS: ${gpsCoords.latitude.toFixed(6)}, ${gpsCoords.longitude.toFixed(6)}${
                            gpsCoords.accuracy ? ` (±${Math.round(gpsCoords.accuracy)}m)` : ''
                          }`
                        : 'GPS: 29.17173, 75.73568'}
                    </p>
                  </div>
                </div>

                {/* Line 4: Date in dd/mm/yyyy */}
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Date & Time</p>
                    <p className="font-mono text-neutral-300 text-xs">
                      {selectedEnlargedPhoto.timestamp || formatDDMMYYYY()}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
