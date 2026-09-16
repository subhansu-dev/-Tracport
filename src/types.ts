export interface GPSCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  areaName?: string;
  pincode?: string;
}

export interface UploadedImage {
  id: string;
  name: string;
  dataUrl: string;
  locationName?: string;
  pincode?: string;
  coords?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  timestamp?: string;
}

export interface InspectionCompartment {
  id: string;
  title: string;
  description: string;
  rating: number; // 1 to 5
  images?: UploadedImage[];
}

export interface ExtraDescription {
  id: string;
  title: string;
  content: string;
}

export interface ExtraRating {
  id: string;
  title: string;
  rating: number;
}

export interface Inspection {
  id: string;
  location: string;
  gpsCoords: GPSCoords | null;
  peopleCount: string;
  people: string[];
  images: UploadedImage[];
  description: string;
  rating: number;
  compartments?: InspectionCompartment[];
  extraDescriptions?: ExtraDescription[];
  extraRatings?: ExtraRating[];
  createdAt: string;
  updatedAt?: string;
  isSynced?: boolean;
}

export type AppScreen = 'intro' | 'login' | 'interface' | 'details';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}
