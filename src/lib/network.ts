// Network status manager.
//
// Offline simulation is a development-only convenience used to exercise the
// genuine offline queue. It is disabled outside development so a stale local
// flag can never force a real-user environment into a permanent offline state.

type NetworkListener = (isOnline: boolean) => void;

const SIMULATION_ENABLED = import.meta.env?.DEV ?? false;

class NetworkManager {
  private isSimulatedOffline: boolean = false;
  private listeners: Set<NetworkListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      if (SIMULATION_ENABLED) {
        const savedSim = localStorage.getItem('GMA_SIMULATE_OFFLINE');
        if (savedSim === 'true') {
          this.isSimulatedOffline = true;
        }
      } else {
        // Purge any stale simulation flag left over from development.
        localStorage.removeItem('GMA_SIMULATE_OFFLINE');
      }

      window.addEventListener('online', () => this.notify());
      window.addEventListener('offline', () => this.notify());
    }
  }

  public isOnline(): boolean {
    if (this.isSimulatedOffline) return false;
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  }

  public isSimulatingOffline(): boolean {
    return this.isSimulatedOffline;
  }

  public isSimulationAvailable(): boolean {
    return SIMULATION_ENABLED;
  }

  public setSimulatedOffline(offline: boolean): void {
    if (!SIMULATION_ENABLED) return;
    this.isSimulatedOffline = offline;
    localStorage.setItem('GMA_SIMULATE_OFFLINE', offline ? 'true' : 'false');
    this.notify();
  }

  public toggleSimulation(): boolean {
    if (!SIMULATION_ENABLED) return false;
    this.setSimulatedOffline(!this.isSimulatedOffline);
    return this.isSimulatedOffline;
  }

  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    listener(this.isOnline());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const status = this.isOnline();
    this.listeners.forEach((listener) => listener(status));
  }
}

export const networkManager = new NetworkManager();
