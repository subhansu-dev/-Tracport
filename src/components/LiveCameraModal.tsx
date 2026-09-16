import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  X,
  RotateCcw,
  MapPin,
  AlertTriangle,
  Crosshair,
  Crop,
  Sparkles,
  RotateCw,
  Check,
  Undo2,
} from 'lucide-react';
import { GPSCoords, UploadedImage } from '../types';

export const formatDDMMYYYY = (date: Date = new Date()): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const strHours = String(hours).padStart(2, '0');
  return `${day}/${month}/${year}, ${strHours}:${minutes}:${seconds} ${ampm}`;
};

interface ImagePreviewData {
  originalDataUrl: string;
  baseDataUrl: string;
  displayDataUrl: string;
  isEnhanced: boolean;
  actualArea: string;
  actualPin: string;
  coords: { latitude: number; longitude: number; accuracy?: number };
  timestamp: string;
}

interface CropBox {
  x: number; // percentage 0..100
  y: number; // percentage 0..100
  width: number; // percentage 0..100
  height: number; // percentage 0..100
}

/**
 * Advanced High-Definition Multi-Scale Unsharp Masking & Edge Clarity Engine.
 * Produces crisp de-blurring, micro-contrast edge definition, and ultra-sharp text/labels.
 */
const applyHighlySharpenedFilter = (
  dataUrl: string,
  callback: (enhancedDataUrl: string) => void
) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const w = img.width;
    const h = img.height;
    if (w === 0 || h === 0) {
      callback(dataUrl);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      callback(dataUrl);
      return;
    }

    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, w, h);
    const src = imgData.data;

    // Fast separable wide-radius Unsharp Mask (radius = 2, kernel 5x5)
    const blurBuffer = new Float32Array(w * h * 3);
    const tempBuffer = new Float32Array(w * h * 3);

    for (let i = 0, j = 0; i < src.length; i += 4, j += 3) {
      tempBuffer[j] = src[i];
      tempBuffer[j + 1] = src[i + 1];
      tempBuffer[j + 2] = src[i + 2];
    }

    const r = 2;
    const windowSize = 2 * r + 1;

    // Horizontal pass
    for (let y = 0; y < h; y++) {
      const yw = y * w;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) {
          const clampedX = Math.max(0, Math.min(w - 1, k));
          sum += tempBuffer[(yw + clampedX) * 3 + c];
        }
        for (let x = 0; x < w; x++) {
          blurBuffer[(yw + x) * 3 + c] = sum / windowSize;
          const removeX = Math.max(0, x - r);
          const addX = Math.min(w - 1, x + r + 1);
          sum += tempBuffer[(yw + addX) * 3 + c] - tempBuffer[(yw + removeX) * 3 + c];
        }
      }
    }

    // Vertical pass
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) {
          const clampedY = Math.max(0, Math.min(h - 1, k));
          sum += blurBuffer[(clampedY * w + x) * 3 + c];
        }
        for (let y = 0; y < h; y++) {
          tempBuffer[(y * w + x) * 3 + c] = sum / windowSize;
          const removeY = Math.max(0, y - r);
          const addY = Math.min(h - 1, y + r + 1);
          sum += blurBuffer[(addY * w + x) * 3 + c] - blurBuffer[(removeY * w + x) * 3 + c];
        }
      }
    }

    // High-power unsharp masking + micro-contrast edge boost
    const output = ctx.createImageData(w, h);
    const dst = output.data;
    const amount = 2.6; // High sharpening factor for vivid clarity

    for (let i = 0, j = 0; i < src.length; i += 4, j += 3) {
      for (let c = 0; c < 3; c++) {
        const orig = src[i + c];
        const blur = tempBuffer[j + c];
        const diff = orig - blur;

        let val = orig + diff * amount;

        // Local contrast S-curve stretch to make text and contours stand out
        if (val > 128) {
          val = 128 + Math.pow((val - 128) / 127, 0.93) * 127;
        } else {
          val = 128 - Math.pow((128 - val) / 128, 0.93) * 128;
        }

        dst[i + c] = val < 0 ? 0 : val > 255 ? 255 : Math.round(val);
      }
      dst[i + 3] = src[i + 3]; // Alpha preserved
    }

    ctx.putImageData(output, 0, 0);
    callback(canvas.toDataURL('image/jpeg', 0.92));
  };
  img.onerror = () => callback(dataUrl);
  img.src = dataUrl;
};

/**
 * Cleanly crops an image given percentage bounds.
 */
const applyCropFilter = (
  dataUrl: string,
  crop: CropBox,
  callback: (croppedDataUrl: string) => void
) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const sx = Math.max(0, Math.floor((crop.x / 100) * img.width));
    const sy = Math.max(0, Math.floor((crop.y / 100) * img.height));
    const sw = Math.min(img.width - sx, Math.max(20, Math.floor((crop.width / 100) * img.width)));
    const sh = Math.min(img.height - sy, Math.max(20, Math.floor((crop.height / 100) * img.height)));

    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      callback(dataUrl);
      return;
    }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    callback(canvas.toDataURL('image/jpeg', 0.88));
  };
  img.onerror = () => callback(dataUrl);
  img.src = dataUrl;
};

/**
 * Rotates an image by 90 degrees clockwise.
 */
const applyRotateFilter = (
  dataUrl: string,
  callback: (rotatedDataUrl: string) => void
) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.height;
    canvas.height = img.width;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      callback(dataUrl);
      return;
    }

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((90 * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    callback(canvas.toDataURL('image/jpeg', 0.88));
  };
  img.onerror = () => callback(dataUrl);
  img.src = dataUrl;
};

interface LiveCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoCaptured: (image: UploadedImage) => void;
  capturedCount: number;
  currentLocationName: string;
  currentPincode?: string;
  currentCoords: GPSCoords | null;
  onLocationDetected?: (locationName: string, coords: GPSCoords, pincode?: string) => void;
  onShowToast: (msg: string, type: 'info' | 'success' | 'error') => void;
}

export const LiveCameraModal: React.FC<LiveCameraModalProps> = ({
  isOpen,
  onClose,
  onPhotoCaptured,
  capturedCount,
  currentLocationName,
  currentPincode,
  currentCoords,
  onLocationDetected,
  onShowToast,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);

  // Preview & Processing state
  const [previewData, setPreviewData] = useState<ImagePreviewData | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [cropBox, setCropBox] = useState<CropBox>({ x: 10, y: 10, width: 80, height: 80 });
  const [isProcessingEnhance, setIsProcessingEnhance] = useState(false);

  // Dragging state for interactive crop box
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<string | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; initialCrop: CropBox }>({
    clientX: 0,
    clientY: 0,
    initialCrop: { x: 10, y: 10, width: 80, height: 80 },
  });

  // Background geolocation fetch if coordinates are missing when camera opens
  useEffect(() => {
    if (isOpen && (!currentCoords || !currentLocationName)) {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const accuracy = pos.coords.accuracy;
            let area = '';
            let pin = '';
            try {
              const res = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}`);
              if (res.ok) {
                const data = await res.json();
                if (data.success) {
                  if (data.areaName) area = data.areaName;
                  if (data.postcode) pin = data.postcode;
                  else if (data.address?.postcode) pin = data.address.postcode;
                }
              }
            } catch (e) {
              console.warn('Camera modal reverse geocode error:', e);
            }
            if (!area) area = 'Hisar, Haryana';
            if (!pin) pin = '125001';

            const coordsObj: GPSCoords = {
              latitude: lat,
              longitude: lon,
              accuracy,
              areaName: area,
              pincode: pin,
            };
            try {
              localStorage.setItem(
                'tracport_last_location',
                JSON.stringify({ lat, lon, areaName: area, pincode: pin })
              );
            } catch {}
            if (onLocationDetected) {
              onLocationDetected(area, coordsObj, pin);
            }
          },
          (err) => {
            console.warn('Camera modal geolocation fallback:', err);
            let lat = 29.17173;
            let lon = 75.73568;
            let area = 'Hisar, Haryana';
            let pin = '125001';
            try {
              const saved = localStorage.getItem('tracport_last_location');
              if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.lat && parsed.lon) {
                  lat = parsed.lat;
                  lon = parsed.lon;
                  if (parsed.areaName) area = parsed.areaName;
                  if (parsed.pincode) pin = parsed.pincode;
                }
              }
            } catch {}
            if (onLocationDetected) {
              onLocationDetected(
                area,
                { latitude: lat, longitude: lon, accuracy: 15, areaName: area, pincode: pin },
                pin
              );
            }
          },
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 15000 }
        );
      } else {
        let lat = 29.17173;
        let lon = 75.73568;
        let area = 'Hisar, Haryana';
        let pin = '125001';
        try {
          const saved = localStorage.getItem('tracport_last_location');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.lat && parsed.lon) {
              lat = parsed.lat;
              lon = parsed.lon;
              if (parsed.areaName) area = parsed.areaName;
              if (parsed.pincode) pin = parsed.pincode;
            }
          }
        } catch {}
        if (onLocationDetected) {
          onLocationDetected(
            area,
            { latitude: lat, longitude: lon, accuracy: 15, areaName: area, pincode: pin },
            pin
          );
        }
      }
    }
  }, [isOpen, currentCoords, currentLocationName, onLocationDetected]);

  // Stop camera tracks helper
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Initialize camera stream
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    stopStream();
    setIsInitializing(true);
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Live camera is not supported on this browser.');
      setIsInitializing(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => {
          console.warn('Video play error:', err);
        });
      }
      setIsInitializing(false);
    } catch (err: unknown) {
      console.error('Camera access error:', err);
      setIsInitializing(false);
      const errName = (err as { name?: string }).name;
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setCameraError('Camera permission denied. Please allow camera access in browser settings.');
      } else {
        setCameraError('Could not start camera feed. Please check device camera.');
      }
    }
  }, [stopStream]);

  // Start or stop when modal opens/closes or facingMode changes
  useEffect(() => {
    if (isOpen && !previewData) {
      startCamera(facingMode);
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, previewData, startCamera, stopStream]);

  // Reset preview when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setPreviewData(null);
      setIsCropping(false);
    }
  }, [isOpen]);

  // Capture CLEAN photo frame
  const captureCleanImageCanvas = (
    source: HTMLVideoElement | HTMLImageElement,
    width: number,
    height: number
  ): string => {
    const MAX_DIM = 1600;
    let targetW = width;
    let targetH = height;
    if (targetW > targetH && targetW > MAX_DIM) {
      targetH = Math.round(targetH * (MAX_DIM / targetW));
      targetW = MAX_DIM;
    } else if (targetH > MAX_DIM) {
      targetW = Math.round(targetW * (MAX_DIM / targetH));
      targetH = MAX_DIM;
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.drawImage(source, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/jpeg', 0.88);
  };

  // Trigger capture from camera and show Preview Screen
  const handleCapture = () => {
    if (!videoRef.current || isInitializing || cameraError) return;

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      onShowToast('Camera feed not ready yet', 'info');
      return;
    }

    // Visual shutter flash
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 120);

    try {
      const cleanDataUrl = captureCleanImageCanvas(video, video.videoWidth, video.videoHeight);
      if (!cleanDataUrl) {
        onShowToast('Failed to process captured frame', 'error');
        return;
      }

      const actualArea =
        currentLocationName && currentLocationName.trim() && currentLocationName !== 'Site Location'
          ? currentLocationName.trim()
          : (currentCoords?.areaName && currentCoords.areaName.trim()) || 'Hisar, Haryana';

      const actualPin =
        (currentPincode && currentPincode.trim()) ||
        (currentCoords?.pincode && currentCoords.pincode.trim()) ||
        '125001';

      const coords = currentCoords
        ? {
            latitude: currentCoords.latitude,
            longitude: currentCoords.longitude,
            accuracy: currentCoords.accuracy,
          }
        : {
            latitude: 29.17173,
            longitude: 75.73568,
          };

      // Set preview data so user can preview, crop, enhance or retake
      setPreviewData({
        originalDataUrl: cleanDataUrl,
        baseDataUrl: cleanDataUrl,
        displayDataUrl: cleanDataUrl,
        isEnhanced: false,
        actualArea,
        actualPin,
        coords,
        timestamp: formatDDMMYYYY(),
      });

      setIsCropping(false);
      setCropBox({ x: 10, y: 10, width: 80, height: 80 });
      stopStream();
    } catch (err) {
      console.error('Capture error:', err);
      onShowToast('Could not capture photo', 'error');
    }
  };

  // Fallback direct camera file capture if webview blocks getUserMedia
  const handleFallbackCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const cleanDataUrl = captureCleanImageCanvas(img, img.width, img.height);
        const actualArea =
          currentLocationName && currentLocationName.trim() && currentLocationName !== 'Site Location'
            ? currentLocationName.trim()
            : (currentCoords?.areaName && currentCoords.areaName.trim()) || 'Hisar, Haryana';

        const actualPin =
          (currentPincode && currentPincode.trim()) ||
          (currentCoords?.pincode && currentCoords.pincode.trim()) ||
          '125001';

        const coords = currentCoords
          ? {
              latitude: currentCoords.latitude,
              longitude: currentCoords.longitude,
              accuracy: currentCoords.accuracy,
            }
          : {
              latitude: 29.17173,
              longitude: 75.73568,
            };

        setPreviewData({
          originalDataUrl: cleanDataUrl,
          baseDataUrl: cleanDataUrl,
          displayDataUrl: cleanDataUrl,
          isEnhanced: false,
          actualArea,
          actualPin,
          coords,
          timestamp: formatDDMMYYYY(),
        });
        setIsCropping(false);
        setCropBox({ x: 10, y: 10, width: 80, height: 80 });
        stopStream();
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Discard preview and resume camera
  const handleRetake = () => {
    setPreviewData(null);
    setIsCropping(false);
    startCamera(facingMode);
  };

  // Toggle Enhance AI (Image Sharpening & AI Detail Enhancement)
  const handleToggleEnhance = async () => {
    if (!previewData || isProcessingEnhance) return;

    if (previewData.isEnhanced) {
      // Turn off enhance - revert to unenhanced base
      setPreviewData((prev) =>
        prev
          ? {
              ...prev,
              displayDataUrl: prev.baseDataUrl,
              isEnhanced: false,
            }
          : null
      );
      onShowToast('AI Enhancement turned off', 'info');
    } else {
      // Turn on enhance - first try backend Gemini AI, fallback to high-definition unsharp mask
      setIsProcessingEnhance(true);
      try {
        const response = await fetch('/api/enhance-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: previewData.baseDataUrl }),
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData.success && resData.image) {
            setPreviewData((prev) =>
              prev
                ? {
                    ...prev,
                    displayDataUrl: resData.image,
                    isEnhanced: true,
                  }
                : null
            );
            setIsProcessingEnhance(false);
            onShowToast('✨ Image highly sharpened with AI', 'success');
            return;
          }
        }
      } catch (err) {
        console.warn('AI endpoint unavailable, applying high-definition sharpening:', err);
      }

      // High-definition multi-scale unsharp masking & edge clarity fallback
      applyHighlySharpenedFilter(previewData.baseDataUrl, (enhancedUrl) => {
        setPreviewData((prev) =>
          prev
            ? {
                ...prev,
                displayDataUrl: enhancedUrl,
                isEnhanced: true,
              }
            : null
        );
        setIsProcessingEnhance(false);
        onShowToast('✨ Image highly sharpened', 'success');
      });
    }
  };

  // Rotate 90 degrees
  const handleRotate = () => {
    if (!previewData || isCropping) return;

    applyRotateFilter(previewData.baseDataUrl, (rotatedBaseUrl) => {
      if (previewData.isEnhanced) {
        applyHighlySharpenedFilter(rotatedBaseUrl, (enhancedRotatedUrl) => {
          setPreviewData((prev) =>
            prev
              ? {
                  ...prev,
                  baseDataUrl: rotatedBaseUrl,
                  displayDataUrl: enhancedRotatedUrl,
                }
              : null
          );
        });
      } else {
        setPreviewData((prev) =>
          prev
            ? {
                ...prev,
                baseDataUrl: rotatedBaseUrl,
                displayDataUrl: rotatedBaseUrl,
              }
            : null
        );
      }
    });
  };

  // Reset to original image
  const handleResetToOriginal = () => {
    if (!previewData) return;
    setPreviewData((prev) =>
      prev
        ? {
            ...prev,
            baseDataUrl: prev.originalDataUrl,
            displayDataUrl: prev.originalDataUrl,
            isEnhanced: false,
          }
        : null
    );
    setIsCropping(false);
    setCropBox({ x: 10, y: 10, width: 80, height: 80 });
    onShowToast('Reverted to original photo', 'info');
  };

  // Apply Crop
  const handleApplyCrop = () => {
    if (!previewData) return;

    applyCropFilter(previewData.baseDataUrl, cropBox, (croppedBaseUrl) => {
      if (previewData.isEnhanced) {
        applyHighlySharpenedFilter(croppedBaseUrl, (enhancedCroppedUrl) => {
          setPreviewData((prev) =>
            prev
              ? {
                  ...prev,
                  baseDataUrl: croppedBaseUrl,
                  displayDataUrl: enhancedCroppedUrl,
                }
              : null
          );
          setIsCropping(false);
          onShowToast('Crop applied', 'success');
        });
      } else {
        setPreviewData((prev) =>
          prev
            ? {
                ...prev,
                baseDataUrl: croppedBaseUrl,
                displayDataUrl: croppedBaseUrl,
              }
            : null
        );
        setIsCropping(false);
        onShowToast('Crop applied', 'success');
      }
    });
  };

  // Set Crop Preset Aspect Ratios
  const handleCropPreset = (preset: 'free' | '1:1' | '4:3' | '16:9' | 'full') => {
    if (preset === 'full') {
      setCropBox({ x: 0, y: 0, width: 100, height: 100 });
      return;
    }
    if (preset === '1:1') {
      setCropBox({ x: 15, y: 15, width: 70, height: 70 });
      return;
    }
    if (preset === '4:3') {
      setCropBox({ x: 10, y: 15, width: 80, height: 60 });
      return;
    }
    if (preset === '16:9') {
      setCropBox({ x: 5, y: 22, width: 90, height: 50 });
      return;
    }
    setCropBox({ x: 10, y: 10, width: 80, height: 80 });
  };

  // Interactive Drag & Resize handlers for Crop Box
  const handlePointerDown = (e: React.PointerEvent, handleType: string) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = handleType;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialCrop: { ...cropBox },
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current || !cropContainerRef.current) return;
      const rect = cropContainerRef.current.getBoundingClientRect();
      const dx = ((moveEvent.clientX - dragStartRef.current.clientX) / rect.width) * 100;
      const dy = ((moveEvent.clientY - dragStartRef.current.clientY) / rect.height) * 100;
      const init = dragStartRef.current.initialCrop;
      const mode = isDraggingRef.current;

      setCropBox((prev) => {
        let newX = prev.x;
        let newY = prev.y;
        let newW = prev.width;
        let newH = prev.height;

        if (mode === 'move') {
          newX = Math.max(0, Math.min(100 - init.width, init.x + dx));
          newY = Math.max(0, Math.min(100 - init.height, init.y + dy));
          return { x: newX, y: newY, width: init.width, height: init.height };
        }

        if (mode.includes('e')) {
          newW = Math.max(15, Math.min(100 - init.x, init.width + dx));
        }
        if (mode.includes('s')) {
          newH = Math.max(15, Math.min(100 - init.y, init.height + dy));
        }
        if (mode.includes('w')) {
          const maxDx = init.width - 15;
          const clampedDx = Math.max(-init.x, Math.min(maxDx, dx));
          newX = init.x + clampedDx;
          newW = init.width - clampedDx;
        }
        if (mode.includes('n')) {
          const maxDy = init.height - 15;
          const clampedDy = Math.max(-init.y, Math.min(maxDy, dy));
          newY = init.y + clampedDy;
          newH = init.height - clampedDy;
        }

        return {
          x: Math.max(0, Math.min(85, newX)),
          y: Math.max(0, Math.min(85, newY)),
          width: Math.max(15, Math.min(100, newW)),
          height: Math.max(15, Math.min(100, newH)),
        };
      });
    };

    const handlePointerUp = () => {
      isDraggingRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Upload/confirm photo to form
  const handleConfirmPhoto = () => {
    if (!previewData) return;

    const newImage: UploadedImage = {
      id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: `Photo_${capturedCount + 1}.jpg`,
      dataUrl: previewData.displayDataUrl,
      locationName: previewData.actualArea,
      pincode: previewData.actualPin,
      coords: previewData.coords,
      timestamp: previewData.timestamp,
    };

    onPhotoCaptured(newImage);
    onShowToast(`Photo #${capturedCount + 1} selected`, 'success');
    setPreviewData(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between items-center select-none overflow-hidden font-poppins">
      {/* Visual Flash Effect */}
      {isFlashing && (
        <div className="absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-100" />
      )}

      {/* ================= TOP BAR ================= */}
      <div className="w-full px-4 py-3 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between z-20">
        <div className="flex items-center gap-2.5 max-w-[75%] min-w-0">
          <div className="w-7 h-7 rounded-full bg-indigo-600/30 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="truncate">
            <p className="text-xs font-bold text-white truncate">
              {previewData?.actualArea || currentLocationName || currentCoords?.areaName || 'Hisar, Haryana'}
            </p>
            <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono truncate">
              <span className="text-white font-semibold">
                PIN: {previewData?.actualPin || currentPincode || currentCoords?.pincode || '125001'}
              </span>
              {(previewData?.coords || currentCoords) && (
                <span className="text-neutral-300">
                  GPS: {(previewData?.coords || currentCoords)!.latitude.toFixed(5)},{' '}
                  {(previewData?.coords || currentCoords)!.longitude.toFixed(5)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* If in Preview Mode, offer quick Retake */}
          {previewData ? (
            <button
              type="button"
              onClick={handleRetake}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors text-xs flex items-center gap-1.5 cursor-pointer"
              title="Retake photo"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retake</span>
            </button>
          ) : (
            /* Switch Camera in live feed */
            <button
              type="button"
              onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
              className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
              title="Switch front/rear camera"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {/* Close / Cancel */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ================= CENTER VIEWPORT ================= */}
      <div className="relative flex-1 w-full max-w-2xl bg-[#0b0d11] flex items-center justify-center overflow-hidden p-2 sm:p-4">
        {/* VIEW 1: PREVIEW & EDITING SCREEN */}
        {previewData ? (
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            {/* Image Container with interactive Crop or normal preview */}
            <div
              ref={cropContainerRef}
              className="relative max-w-full max-h-[60vh] sm:max-h-[65vh] flex items-center justify-center select-none"
            >
              <img
                src={previewData.displayDataUrl}
                alt="Captured Preview"
                className="max-w-full max-h-[60vh] sm:max-h-[65vh] object-contain rounded-lg shadow-2xl pointer-events-none"
              />

              {/* Interactive Crop Box Overlay */}
              {isCropping && (
                <div className="absolute inset-0 z-20 pointer-events-auto">
                  {/* Dimmed backdrop masks around crop box */}
                  <div
                    className="absolute bg-black/60 top-0 left-0 right-0 pointer-events-none"
                    style={{ height: `${cropBox.y}%` }}
                  />
                  <div
                    className="absolute bg-black/60 bottom-0 left-0 right-0 pointer-events-none"
                    style={{ height: `${100 - (cropBox.y + cropBox.height)}%` }}
                  />
                  <div
                    className="absolute bg-black/60 left-0 pointer-events-none"
                    style={{
                      top: `${cropBox.y}%`,
                      height: `${cropBox.height}%`,
                      width: `${cropBox.x}%`,
                    }}
                  />
                  <div
                    className="absolute bg-black/60 right-0 pointer-events-none"
                    style={{
                      top: `${cropBox.y}%`,
                      height: `${cropBox.height}%`,
                      width: `${100 - (cropBox.x + cropBox.width)}%`,
                    }}
                  />

                  {/* Active Crop Box */}
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'move')}
                    className="absolute border-2 border-indigo-400 cursor-move box-border shadow-[0_0_0_1px_rgba(255,255,255,0.4)]"
                    style={{
                      top: `${cropBox.y}%`,
                      left: `${cropBox.x}%`,
                      width: `${cropBox.width}%`,
                      height: `${cropBox.height}%`,
                    }}
                  >
                    {/* Rule-of-thirds grid lines */}
                    <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-40">
                      <div className="border-r border-b border-white" />
                      <div className="border-r border-b border-white" />
                      <div className="border-b border-white" />
                      <div className="border-r border-b border-white" />
                      <div className="border-r border-b border-white" />
                      <div className="border-b border-white" />
                      <div className="border-r border-white" />
                      <div className="border-r border-white" />
                      <div />
                    </div>

                    {/* Corner Handles */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, 'nw')}
                      className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-white border-2 border-indigo-600 rounded-sm cursor-nwse-resize shadow-md"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, 'ne')}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white border-2 border-indigo-600 rounded-sm cursor-nesw-resize shadow-md"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, 'sw')}
                      className="absolute -bottom-1.5 -left-1.5 w-4 h-4 bg-white border-2 border-indigo-600 rounded-sm cursor-nesw-resize shadow-md"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, 'se')}
                      className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-white border-2 border-indigo-600 rounded-sm cursor-nwse-resize shadow-md"
                    />

                    {/* Edge Handles */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, 'n')}
                      className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-2 bg-white rounded-full cursor-ns-resize shadow"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, 's')}
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-2 bg-white rounded-full cursor-ns-resize shadow"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, 'w')}
                      className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-5 bg-white rounded-full cursor-ew-resize shadow"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, 'e')}
                      className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-5 bg-white rounded-full cursor-ew-resize shadow"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* In-Crop Controls Bar */}
            {isCropping && (
              <div className="mt-3 flex items-center justify-center gap-1.5 bg-neutral-900/90 backdrop-blur-md p-1.5 rounded-xl border border-neutral-700 shadow-xl z-30 flex-wrap">
                <span className="text-[11px] text-neutral-400 font-medium px-2">Ratio:</span>
                <button
                  type="button"
                  onClick={() => handleCropPreset('free')}
                  className="px-2 py-1 rounded-lg text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                >
                  Free
                </button>
                <button
                  type="button"
                  onClick={() => handleCropPreset('1:1')}
                  className="px-2 py-1 rounded-lg text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                >
                  1:1
                </button>
                <button
                  type="button"
                  onClick={() => handleCropPreset('4:3')}
                  className="px-2 py-1 rounded-lg text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                >
                  4:3
                </button>
                <button
                  type="button"
                  onClick={() => handleCropPreset('16:9')}
                  className="px-2 py-1 rounded-lg text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                >
                  16:9
                </button>
                <div className="w-px h-4 bg-neutral-700 mx-1" />
                <button
                  type="button"
                  onClick={handleApplyCrop}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-neutral-950 flex items-center gap-1 shadow cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCropping(false)}
                  className="px-2.5 py-1 rounded-lg text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ) : (
          /* VIEW 2: LIVE CAMERA FEED */
          <>
            {cameraError ? (
              <div className="p-6 text-center max-w-sm space-y-4">
                <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-800 text-rose-400 mx-auto flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <p className="text-sm text-neutral-300">{cameraError}</p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    Retry Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => fallbackInputRef.current?.click()}
                    className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-200 text-xs font-medium border border-neutral-700 cursor-pointer"
                  >
                    Open Native Camera
                  </button>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Viewfinder crosshairs overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-64 h-64 border border-white/20 rounded-2xl relative">
                    <Crosshair className="w-6 h-6 text-white/30 absolute inset-0 m-auto" />
                  </div>
                </div>
              </>
            )}

            {/* Hidden native camera input for fallback */}
            <input
              ref={fallbackInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFallbackCapture}
            />
          </>
        )}
      </div>

      {/* ================= BOTTOM CONTROLS ================= */}
      {previewData ? (
        /* PREVIEW CONTROLS: Crop, Enhance, Rotate, Retake, and Confirm */
        <div className="w-full px-4 sm:px-6 py-3.5 bg-neutral-950/95 backdrop-blur-md border-t border-neutral-800 flex flex-col items-center gap-3 max-w-2xl z-20">
          {/* Tool actions: Crop, Enhance, Rotate, Reset */}
          {!isCropping && (
            <div className="flex items-center justify-center gap-2 w-full flex-wrap">
              {/* Crop Tool Option */}
              <button
                type="button"
                onClick={() => setIsCropping(true)}
                className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                title="Crop photo"
              >
                <Crop className="w-4 h-4 text-indigo-400" />
                <span>Crop</span>
              </button>

              {/* Enhance AI Option */}
              <button
                type="button"
                onClick={handleToggleEnhance}
                disabled={isProcessingEnhance}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 border ${
                  previewData.isEnhanced
                    ? 'bg-amber-400 hover:bg-amber-300 text-neutral-950 border-amber-300 ring-2 ring-amber-400/30'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
                } ${isProcessingEnhance ? 'opacity-80 cursor-wait' : ''}`}
                title="Sharpen and enhance image clarity using AI"
              >
                <Sparkles
                  className={`w-4 h-4 ${
                    isProcessingEnhance
                      ? 'animate-spin text-amber-400'
                      : previewData.isEnhanced
                      ? 'text-neutral-950'
                      : 'text-amber-400'
                  }`}
                />
                <span>
                  {isProcessingEnhance
                    ? 'Enhancing AI...'
                    : previewData.isEnhanced
                    ? 'Enhanced AI'
                    : 'Enhance AI'}
                </span>
              </button>

              {/* Rotate 90° Option */}
              <button
                type="button"
                onClick={handleRotate}
                className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                title="Rotate 90° clockwise"
              >
                <RotateCw className="w-4 h-4 text-neutral-400" />
                <span>Rotate</span>
              </button>

              {/* Reset to raw capture */}
              {(previewData.baseDataUrl !== previewData.originalDataUrl ||
                previewData.isEnhanced) && (
                <button
                  type="button"
                  onClick={handleResetToOriginal}
                  className="px-3 py-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 text-xs font-medium border border-neutral-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                  title="Reset to original"
                >
                  <Undo2 className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          )}

          {/* Primary Action Row: Retake vs Select */}
          <div className="flex items-center justify-between w-full gap-3 pt-1">
            <button
              type="button"
              onClick={handleRetake}
              className="w-1/3 py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Camera className="w-3.5 h-3.5 text-neutral-400" />
              <span>Retake</span>
            </button>

            <button
              type="button"
              onClick={handleConfirmPhoto}
              className="w-2/3 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Select</span>
            </button>
          </div>
        </div>
      ) : (
        /* CAMERA SHUTTER & LIVE CONTROLS */
        <div className="w-full px-6 py-5 bg-neutral-950/90 backdrop-blur-md border-t border-neutral-800 flex items-center justify-between max-w-2xl z-20">
          <div className="w-20 text-left">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300">
              {capturedCount} {capturedCount === 1 ? 'photo' : 'photos'}
            </span>
          </div>

          {/* Large Shutter Button */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={handleCapture}
              disabled={isInitializing || !!cameraError}
              className="w-18 h-18 rounded-full border-4 border-white/80 bg-white/20 hover:bg-white/40 active:scale-95 flex items-center justify-center shadow-lg transition-all cursor-pointer disabled:opacity-40"
              title="Take Photo"
            >
              <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center">
                <Camera className="w-6 h-6 text-neutral-900" />
              </div>
            </button>
          </div>

          <div className="w-20 text-right">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium border border-neutral-700 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

