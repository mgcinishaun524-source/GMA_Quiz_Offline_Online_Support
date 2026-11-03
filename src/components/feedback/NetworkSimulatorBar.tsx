import React, { useEffect, useState } from 'react';
import { networkManager } from '../../lib/network';
import { syncQueueService, SyncState } from '../../lib/sync-queue';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export const NetworkSimulatorBar: React.FC = () => {
  const [isOnline, setIsOnline] = useState(networkManager.isOnline());
  const [isSimulated, setIsSimulated] = useState(networkManager.isSimulatingOffline());
  const [syncState, setSyncState] = useState<SyncState>(syncQueueService.getState());
  const simulationAvailable = networkManager.isSimulationAvailable();

  useEffect(() => {
    const unsubNet = networkManager.subscribe((status) => {
      setIsOnline(status);
      setIsSimulated(networkManager.isSimulatingOffline());
    });
    const unsubSync = syncQueueService.subscribe((state) => setSyncState(state));
    return () => { unsubNet(); unsubSync(); };
  }, []);

  const handleToggleOffline = () => {
    networkManager.toggleSimulation();
    setIsSimulated(networkManager.isSimulatingOffline());
    setIsOnline(networkManager.isOnline());
  };

  const handleSyncNow = async () => {
    await syncQueueService.processQueue();
  };

  return (
    <div
      className={[
        'text-xs px-4 py-1 flex flex-wrap items-center justify-between gap-2',
        'border-b transition-colors duration-300',
        isOnline
          ? 'bg-[#0B1F4B] border-white/[0.06]'
          : 'bg-amber-950/80 border-amber-400/20',
      ].join(' ')}
    >
      {/* ── Left: status ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        {isOnline ? (
          <span className="flex items-center gap-1.5 text-slate-400 font-medium">
            <Wifi size={11} className="text-[#D6A21E]/70 shrink-0" aria-hidden="true" />
            <span>Connected</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
            <WifiOff size={11} className="shrink-0" aria-hidden="true" />
            <span>Offline Mode Active</span>
          </span>
        )}

        {/* Queued badge */}
        {syncState.pendingCount > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/25 text-amber-300 text-[10px] font-semibold">
            {syncState.pendingCount} {syncState.pendingCount === 1 ? 'submission' : 'submissions'} queued
          </span>
        )}

        {/* Syncing */}
        {syncState.isSyncing && (
          <span className="flex items-center gap-1 text-[#D6A21E]/60 text-[10px]">
            <RefreshCw size={10} className="animate-spin" aria-hidden="true" />
            Syncing…
          </span>
        )}
      </div>

      {/* ── Right: controls ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {simulationAvailable && (
          <button
            onClick={handleToggleOffline}
            type="button"
            className={[
              'px-2.5 py-0.5 text-[10px] font-semibold rounded-md border',
              'cursor-pointer transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D6A21E]/50',
              isSimulated
                ? 'bg-[#D6A21E] text-[#0B1F4B] border-[#D6A21E] hover:bg-[#C4941C] active:scale-[0.97]'
                : 'bg-transparent text-slate-500 border-white/[0.12] hover:border-white/25 hover:text-slate-300 active:scale-[0.97]',
            ].join(' ')}
          >
            {isSimulated ? 'Go Online' : 'Simulate Offline'}
          </button>
        )}

        {syncState.pendingCount > 0 && isOnline && (
          <button
            onClick={handleSyncNow}
            disabled={syncState.isSyncing}
            type="button"
            className="flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold
              bg-[#D6A21E]/90 text-[#0B1F4B] rounded-md border border-[#D6A21E]
              hover:bg-[#D6A21E] active:scale-[0.97]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-150 cursor-pointer"
          >
            <RefreshCw size={9} className={syncState.isSyncing ? 'animate-spin' : ''} aria-hidden="true" />
            Sync Now
          </button>
        )}
      </div>
    </div>
  );
};
