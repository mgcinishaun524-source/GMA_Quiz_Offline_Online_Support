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
    <div className="bg-[#0B1F4B]/95 text-white text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-white/10">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Connection status */}
        {isOnline ? (
          <span className="flex items-center gap-1.5 text-[#D6A21E]/90 font-medium">
            <Wifi size={12} className="shrink-0" />
            Connected
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
            <WifiOff size={12} className="shrink-0" />
            Offline Mode Active
          </span>
        )}

        {/* Queued submissions badge */}
        {syncState.pendingCount > 0 && (
          <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full text-[11px] font-semibold">
            {syncState.pendingCount} {syncState.pendingCount === 1 ? 'submission' : 'submissions'} queued
          </span>
        )}

        {/* Syncing indicator */}
        {syncState.isSyncing && (
          <span className="flex items-center gap-1 text-[#D6A21E]/80 animate-pulse">
            <RefreshCw size={11} className="animate-spin" />
            Syncing…
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {simulationAvailable && (
          <button
            onClick={handleToggleOffline}
            type="button"
            className={`
              px-2.5 py-0.5 text-[11px] font-semibold rounded-full border cursor-pointer transition-all duration-150
              ${isSimulated
                ? 'bg-[#D6A21E] text-[#0B1F4B] border-[#D6A21E] hover:bg-[#C4941C]'
                : 'bg-transparent text-white/70 border-white/20 hover:border-white/50 hover:text-white'
              }
            `}
          >
            {isSimulated ? 'Go Online' : 'Simulate Offline'}
          </button>
        )}

        {syncState.pendingCount > 0 && isOnline && (
          <button
            onClick={handleSyncNow}
            disabled={syncState.isSyncing}
            type="button"
            className="flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold bg-[#D6A21E] text-[#0B1F4B] rounded-full hover:bg-[#C4941C] disabled:opacity-50 transition-all duration-150 cursor-pointer"
          >
            <RefreshCw size={10} className={syncState.isSyncing ? 'animate-spin' : ''} />
            Sync Now
          </button>
        )}
      </div>
    </div>
  );
};
