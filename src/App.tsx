/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AppScreen, Inspection, ToastMessage } from './types';
import { 
  fetchAllInspections, 
  saveInspectionReport, 
  deleteInspectionReport, 
  syncPendingQueue, 
  getOfflineQueue,
  submitSingleOfflineReport
} from './services/storage';
import { IntroScreen } from './components/IntroScreen';
import { LoginScreen } from './components/LoginScreen';
import { InterfaceScreen } from './components/InterfaceScreen';
import { InspectionFormScreen } from './components/InspectionFormScreen';
import { InspectionModal } from './components/InspectionModal';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('intro');
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Math.random().toString();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 2800);
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchAllInspections();
      setInspections(res.inspections);
      setOfflineQueueCount(getOfflineQueue().length);
    } catch (err) {
      console.error('Failed to load inspections:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load & network listener
  useEffect(() => {
    refreshData();

    const handleOnline = async () => {
      setIsOnline(true);
      showToast('Back online — syncing stored inspections...', 'info');
      const synced = await syncPendingQueue();
      await refreshData();
      if (synced > 0) {
        showToast(`Successfully synced ${synced} offline report(s)!`, 'success');
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('Working offline. Reports will be saved locally.', 'info');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshData, showToast]);

  // Actions
  const handleSaveOffline = async (data: Omit<Inspection, 'id' | 'createdAt'>) => {
    await saveInspectionReport({ ...data, isSynced: false });
    await refreshData();
    showToast('Saved offline to local database', 'success');
  };

  const handleSubmitReport = async (data: Omit<Inspection, 'id' | 'createdAt'>) => {
    const result = await saveInspectionReport(data);
    await refreshData();
    showToast(
      result.savedOnline
        ? 'Inspection successfully submitted & saved to server database!'
        : 'Inspection saved offline. Will sync when online.',
      'success'
    );
    setTimeout(() => {
      setCurrentScreen('interface');
    }, 900);
  };

  const handleDeleteInspection = async (id: string) => {
    await deleteInspectionReport(id);
    setSelectedInspection(null);
    await refreshData();
    showToast('Inspection report deleted', 'info');
  };

  const handleSubmitOfflineInspection = async (id: string) => {
    if (!isOnline) {
      showToast('You are currently offline. Connect to the internet to submit.', 'info');
      return;
    }
    showToast('Submitting offline report to server...', 'info');
    const success = await submitSingleOfflineReport(id);
    if (success) {
      // Optimistically update React state immediately
      setInspections((prev) =>
        prev.map((i) => (i.id === id ? { ...i, isSynced: true } : i))
      );
      setOfflineQueueCount((prev) => Math.max(0, prev - 1));
      setSelectedInspection((prev) => (prev && prev.id === id ? { ...prev, isSynced: true } : prev));
      showToast('Report submitted online successfully!', 'success');
    } else {
      showToast('Failed to submit report to server. Please try again.', 'error');
    }
    await refreshData();
  };

  const handleManualSync = async () => {
    showToast('Syncing pending inspections...', 'info');
    const synced = await syncPendingQueue();
    if (synced > 0) {
      setInspections((prev) => prev.map((i) => ({ ...i, isSynced: true })));
      setOfflineQueueCount(0);
      showToast(`Synced ${synced} inspection(s) successfully!`, 'success');
    } else {
      showToast('All inspections are already up to date.', 'success');
    }
    await refreshData();
  };

  return (
    <main className="min-h-screen w-full relative bg-[#1e222b] font-poppins selection:bg-indigo-500 selection:text-white">
      {/* Screen view renderer */}
      {currentScreen === 'intro' && (
        <IntroScreen onContinue={() => setCurrentScreen('login')} />
      )}

      {currentScreen === 'login' && (
        <LoginScreen
          onLogin={(_user) => {
            setCurrentScreen('interface');
            showToast('Logged in successfully', 'success');
          }}
        />
      )}

      {currentScreen === 'interface' && (
        <InterfaceScreen
          inspections={inspections}
          pendingSyncCount={offlineQueueCount}
          isOnline={isOnline}
          isLoading={isLoading}
          onStartInspection={() => setCurrentScreen('details')}
          onSelectInspection={(item) => setSelectedInspection(item)}
          onManualSync={handleManualSync}
          onSubmitOfflineInspection={handleSubmitOfflineInspection}
          onLogout={() => {
            setCurrentScreen('login');
            showToast('Logged out', 'info');
          }}
        />
      )}

      {currentScreen === 'details' && (
        <InspectionFormScreen
          isOnline={isOnline}
          offlineQueueCount={offlineQueueCount}
          onSaveOffline={handleSaveOffline}
          onSubmitReport={handleSubmitReport}
          onCancel={() => setCurrentScreen('interface')}
          onShowToast={showToast}
        />
      )}

      {/* Inspection Details Modal */}
      {selectedInspection && (
        <InspectionModal
          inspection={selectedInspection}
          isOnline={isOnline}
          onSubmitOfflineInspection={handleSubmitOfflineInspection}
          onClose={() => setSelectedInspection(null)}
          onDelete={handleDeleteInspection}
        />
      )}

      {/* Floating Bottom Toast Notification (matches style.css .toast) */}
      {toast && (
        <div
          id="toast"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-2xl flex items-center gap-2 max-w-[90vw] transition-all animate-bounce duration-300 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : toast.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-neutral-800 text-white border border-neutral-700'
          }`}
        >
          <span>{toast.message}</span>
        </div>
      )}
    </main>
  );
}
