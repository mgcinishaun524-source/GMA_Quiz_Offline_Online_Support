import React, { useEffect, useState } from 'react';
import { networkManager } from '../../lib/network';
import { syncQueueService, SyncState } from '../../lib/sync-queue';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export const NetworkSimulatorBar: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(networkManager.isOnline());
  const [isSimulated, setIsSimulated] = useState<boolean>(networkManager.isSimulatingOffline());
  const [syncState, setSyncState] = useState<SyncState>(syncQueueService.getState());
  const simulationAvailable = networkManager.isSimulationAvailable();

  useEffect(() => {
    const unsubNet = networkManager.subscribe((status) => {
      setIsOnline(status);
      setIsSimulated(networkManager.isSimulatingOffline());
    });
    const unsubSync = syncQueueService.subscribe((state) => {
      setSyncState(state);
    });
    return () => {
      unsubNet();
      unsubSync();
    };
  }, []);

  const handleToggleOffline = () => {
    const nextSim = networkManager.toggleSimulation();
    setIsSimulated(nextSim);
    setIsOnline(networkManager.isOnline());
  };

  const handleSyncNow = async () => {
    await syncQueueService.processQueue();
  };

  return (
    <div className="bg-[#1C2C5B] text-white border-b border-[#6CABDD]/30 text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 font-medium">
          {isOnline ? (
            <span className="flex items-center gap-1.5 text-[#6CABDD]">
              <Wifi size={14} className="shrink-0" />
              <span>Network: Connected</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[#FCD34D] font-semibold">
              <WifiOff size={14} className="shrink-0" />
              <span>Network: Offline Mode Active</span>
            </span>
          )}
        </div>

        {syncState.pendingCount > 0 && (
          <span className="bg-[#FEF3C7] text-[#92400E] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
            {syncState.pendingCount} Offline {syncState.pendingCount === 1 ? 'Submission' : 'Submissions'} Queued
          </span>
        )}

        {syncState.isSyncing && (
          <span className="flex items-center gap-1 text-[#6CABDD] animate-pulse">
            <RefreshCw size={12} className="animate-spin" />
            <span>Syncing records with school server...</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {simulationAvailable && (
          <button
            onClick={handleToggleOffline}
            type="button"
            className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider border cursor-pointer transition-colors ${
              isSimulated
                ? 'bg-[#6CABDD] text-[#1C2C5B] border-[#6CABDD] hover:bg-white'
                : 'bg-transparent text-white border-white/30 hover:border-white hover:bg-white/10'
            }`}
            title="Toggle simulated network disconnection to test tablet offline workflows (development only)"
          >
            {isSimulated ? 'Exit Offline Simulation (Go Online)' : 'Simulate Offline Mode'}
          </button>
        )}

        {syncState.pendingCount > 0 && isOnline && (
          <button
            onClick={handleSyncNow}
            disabled={syncState.isSyncing}
            type="button"
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider bg-[#6CABDD] text-[#1C2C5B] hover:bg-white border border-[#6CABDD] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={11} className={syncState.isSyncing ? 'animate-spin' : ''} />
            <span>Sync Now</span>
          </button>
        )}
      </div>
    </div>
  );
};
