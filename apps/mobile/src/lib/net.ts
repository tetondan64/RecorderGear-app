/**
 * Network utilities for sync system
 * Handles network state detection and app state monitoring
 */

import * as Network from 'expo-network';
import { AppState, AppStateStatus } from 'react-native';
import type { NetworkType } from './sync/types';

export class NetworkMonitor {
  private static instance: NetworkMonitor;
  private networkListeners: ((networkType: NetworkType) => void)[] = [];
  private appStateListeners: ((isActive: boolean) => void)[] = [];
  private currentNetworkType: NetworkType = 'UNKNOWN';
  private isAppActive = true;

  private constructor() {
    this.initializeMonitoring();
  }

  static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }

  private async initializeMonitoring(): Promise<void> {
    // Monitor network state changes
    Network.addNetworkStateListener(this.handleNetworkChange.bind(this));
    
    // Monitor app state changes
    AppState.addEventListener('change', this.handleAppStateChange.bind(this));

    // Get initial network state
    try {
      const networkState = await Network.getNetworkStateAsync();
      this.currentNetworkType = this.mapNetworkType(networkState);
    } catch (error) {
      console.warn('NetworkMonitor: Failed to get initial network state:', error);
      this.currentNetworkType = 'UNKNOWN';
    }

    // Get initial app state
    this.isAppActive = AppState.currentState === 'active';
  }

  private handleNetworkChange(networkState: Network.NetworkState): void {
    const newType = this.mapNetworkType(networkState);
    if (newType !== this.currentNetworkType) {
      this.currentNetworkType = newType;
      this.notifyNetworkListeners(newType);
    }
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    const wasActive = this.isAppActive;
    const isActive = nextAppState === 'active';
    
    if (wasActive !== isActive) {
      this.isAppActive = isActive;
      this.notifyAppStateListeners(isActive);
    }
  }

  private mapNetworkType(networkState: Network.NetworkState): NetworkType {
    if (!networkState.isConnected) {
      return 'NONE';
    }

    switch (networkState.type) {
      case Network.NetworkStateType.WIFI:
        return 'WIFI';
      case Network.NetworkStateType.CELLULAR:
        return 'CELLULAR';
      case Network.NetworkStateType.ETHERNET:
        return 'WIFI'; // Treat ethernet as WiFi for sync purposes
      default:
        return 'UNKNOWN';
    }
  }

  private notifyNetworkListeners(networkType: NetworkType): void {
    this.networkListeners.forEach(listener => {
      try {
        listener(networkType);
      } catch (error) {
        console.error('NetworkMonitor: Error in network listener:', error);
      }
    });
  }

  private notifyAppStateListeners(isActive: boolean): void {
    this.appStateListeners.forEach(listener => {
      try {
        listener(isActive);
      } catch (error) {
        console.error('NetworkMonitor: Error in app state listener:', error);
      }
    });
  }

  // Public API
  getCurrentNetworkType(): NetworkType {
    return this.currentNetworkType;
  }

  isAppActive(): boolean {
    return this.isAppActive;
  }

  isNetworkSuitable(requireWifiOnly: boolean): boolean {
    const networkType = this.getCurrentNetworkType();
    
    if (networkType === 'NONE') {
      return false;
    }

    if (requireWifiOnly && networkType !== 'WIFI') {
      return false;
    }

    return true;
  }

  onNetworkChange(listener: (networkType: NetworkType) => void): () => void {
    this.networkListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.networkListeners.indexOf(listener);
      if (index > -1) {
        this.networkListeners.splice(index, 1);
      }
    };
  }

  onAppStateChange(listener: (isActive: boolean) => void): () => void {
    this.appStateListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.appStateListeners.indexOf(listener);
      if (index > -1) {
        this.appStateListeners.splice(index, 1);
      }
    };
  }

  // Utility methods
  async checkConnectivity(): Promise<boolean> {
    try {
      const networkState = await Network.getNetworkStateAsync();
      return networkState.isConnected === true;
    } catch (error) {
      console.error('NetworkMonitor: Failed to check connectivity:', error);
      return false;
    }
  }

  async getNetworkInfo(): Promise<{
    type: NetworkType;
    isConnected: boolean;
    isInternetReachable: boolean | null;
  }> {
    try {
      const networkState = await Network.getNetworkStateAsync();
      return {
        type: this.mapNetworkType(networkState),
        isConnected: networkState.isConnected === true,
        isInternetReachable: networkState.isInternetReachable,
      };
    } catch (error) {
      console.error('NetworkMonitor: Failed to get network info:', error);
      return {
        type: 'UNKNOWN',
        isConnected: false,
        isInternetReachable: null,
      };
    }
  }
}

// Export singleton instance
export const networkMonitor = NetworkMonitor.getInstance();