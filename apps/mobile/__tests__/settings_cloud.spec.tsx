import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CloudSettingsScreen } from '../src/screens/CloudSettingsScreen';
import { cloudSettings } from '../src/lib/settings/cloud';
import { networkMonitor } from '../src/lib/net';
import type { CloudSettings } from '../src/lib/sync/types';

// Mock dependencies
jest.mock('../src/lib/settings/cloud');
jest.mock('../src/lib/net');
jest.mock('../src/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primary: '#007AFF',
        textPrimary: '#000',
        textSecondary: '#666',
        background: '#fff',
        surface: '#f5f5f5',
        border: '#e0e0e0',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      },
      spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
      },
      typography: {
        sizes: {
          sm: 14,
          md: 16,
          lg: 18,
        },
        weights: {
          normal: '400',
          medium: '500',
          bold: '600',
        },
      },
      borderRadius: {
        sm: 8,
        md: 12,
        lg: 16,
      },
    },
  }),
}));

const mockCloudSettings = cloudSettings as jest.Mocked<typeof cloudSettings>;
const mockNetworkMonitor = networkMonitor as jest.Mocked<typeof networkMonitor>;

describe('Cloud Settings Screen', () => {
  let defaultSettings: CloudSettings;

  beforeEach(() => {
    jest.clearAllMocks();
    
    defaultSettings = {
      autoSyncEnabled: true,
      wifiOnly: false,
      paused: false,
    };

    mockCloudSettings.getSettings.mockResolvedValue(defaultSettings);
    mockCloudSettings.updateSettings.mockResolvedValue();
    mockCloudSettings.shouldAllowSync.mockResolvedValue({ allowed: true });
    mockNetworkMonitor.getCurrentNetworkType.mockReturnValue('WIFI');
  });

  describe('Settings initialization', () => {
    it('should load current settings on mount', async () => {
      render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(mockCloudSettings.getSettings).toHaveBeenCalled();
      });
    });

    it('should display current auto-sync setting', async () => {
      const { getByText, getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(getByText('Auto-sync')).toBeTruthy();
        const autoSyncSwitch = getByTestId('auto-sync-switch');
        expect(autoSyncSwitch.props.value).toBe(true);
      });
    });

    it('should display current WiFi-only setting', async () => {
      const customSettings = { ...defaultSettings, wifiOnly: true };
      mockCloudSettings.getSettings.mockResolvedValue(customSettings);

      const { getByText, getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(getByText('WiFi only')).toBeTruthy();
        const wifiOnlySwitch = getByTestId('wifi-only-switch');
        expect(wifiOnlySwitch.props.value).toBe(true);
      });
    });

    it('should display current paused setting', async () => {
      const customSettings = { ...defaultSettings, paused: true };
      mockCloudSettings.getSettings.mockResolvedValue(customSettings);

      const { getByText, getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(getByText('Pause sync')).toBeTruthy();
        const pausedSwitch = getByTestId('pause-sync-switch');
        expect(pausedSwitch.props.value).toBe(true);
      });
    });
  });

  describe('Auto-sync toggle', () => {
    it('should toggle auto-sync setting when switch is pressed', async () => {
      const { getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        const autoSyncSwitch = getByTestId('auto-sync-switch');
        fireEvent(autoSyncSwitch, 'valueChange', false);
      });

      expect(mockCloudSettings.updateSettings).toHaveBeenCalledWith({
        autoSyncEnabled: false,
      });
    });

    it('should update switch state after successful toggle', async () => {
      const { getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        const autoSyncSwitch = getByTestId('auto-sync-switch');
        fireEvent(autoSyncSwitch, 'valueChange', false);
      });

      await waitFor(() => {
        const autoSyncSwitch = getByTestId('auto-sync-switch');
        expect(autoSyncSwitch.props.value).toBe(false);
      });
    });

    it('should show description for auto-sync setting', async () => {
      const { getByText } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(getByText(/Automatically upload new recordings/)).toBeTruthy();
      });
    });

    it('should disable WiFi-only when auto-sync is disabled', async () => {
      const { getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        const autoSyncSwitch = getByTestId('auto-sync-switch');
        fireEvent(autoSyncSwitch, 'valueChange', false);
      });

      await waitFor(() => {
        const wifiOnlySwitch = getByTestId('wifi-only-switch');
        expect(wifiOnlySwitch.props.disabled).toBe(true);
      });
    });
  });

  describe('WiFi-only toggle', () => {
    it('should toggle WiFi-only setting when switch is pressed', async () => {
      const { getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        const wifiOnlySwitch = getByTestId('wifi-only-switch');
        fireEvent(wifiOnlySwitch, 'valueChange', true);
      });

      expect(mockCloudSettings.updateSettings).toHaveBeenCalledWith({
        wifiOnly: true,
      });
    });

    it('should show cellular data warning when WiFi-only is disabled', async () => {
      const { getByText } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(getByText(/may use cellular data/)).toBeTruthy();
      });
    });

    it('should show current network type information', async () => {
      mockNetworkMonitor.getCurrentNetworkType.mockReturnValue('CELLULAR');
      
      const { getByText } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(getByText(/Currently on: Cellular/)).toBeTruthy();
      });
    });

    it('should be disabled when auto-sync is off', async () => {
      const disabledSettings = { ...defaultSettings, autoSyncEnabled: false };
      mockCloudSettings.getSettings.mockResolvedValue(disabledSettings);

      const { getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        const wifiOnlySwitch = getByTestId('wifi-only-switch');
        expect(wifiOnlySwitch.props.disabled).toBe(true);
      });
    });
  });

  describe('Pause sync toggle', () => {
    it('should toggle pause sync setting when switch is pressed', async () => {
      const { getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        const pauseSyncSwitch = getByTestId('pause-sync-switch');
        fireEvent(pauseSyncSwitch, 'valueChange', true);
      });

      expect(mockCloudSettings.updateSettings).toHaveBeenCalledWith({
        paused: true,
      });
    });

    it('should show pause description', async () => {
      const { getByText } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(getByText(/Temporarily stop all sync/)).toBeTruthy();
      });
    });

    it('should show resume hint when paused', async () => {
      const pausedSettings = { ...defaultSettings, paused: true };
      mockCloudSettings.getSettings.mockResolvedValue(pausedSettings);

      const { getByText } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(getByText(/Turn off to resume/)).toBeTruthy();
      });
    });
  });

  describe('Settings persistence', () => {
    it('should persist all settings changes', async () => {
      const { getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        const autoSyncSwitch = getByTestId('auto-sync-switch');
        const wifiOnlySwitch = getByTestId('wifi-only-switch');
        const pauseSyncSwitch = getByTestId('pause-sync-switch');

        fireEvent(autoSyncSwitch, 'valueChange', false);
        fireEvent(wifiOnlySwitch, 'valueChange', true);
        fireEvent(pauseSyncSwitch, 'valueChange', true);
      });

      expect(mockCloudSettings.updateSettings).toHaveBeenCalledTimes(3);
    });

    it('should handle persistence errors gracefully', async () => {
      mockCloudSettings.updateSettings.mockRejectedValue(new Error('Storage error'));
      
      const { getByTestId, getByText } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        const autoSyncSwitch = getByTestId('auto-sync-switch');
        fireEvent(autoSyncSwitch, 'valueChange', false);
      });

      await waitFor(() => {
        expect(getByText(/Failed to save settings/)).toBeTruthy();
      });
    });

    it('should revert switch state on persistence failure', async () => {
      mockCloudSettings.updateSettings.mockRejectedValue(new Error('Storage error'));
      
      const { getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        const autoSyncSwitch = getByTestId('auto-sync-switch');
        fireEvent(autoSyncSwitch, 'valueChange', false);
      });

      await waitFor(() => {
        const autoSyncSwitch = getByTestId('auto-sync-switch');
        expect(autoSyncSwitch.props.value).toBe(true); // Should revert
      });
    });
  });

  describe('Validation logic', () => {
    it('should validate settings combination on load', async () => {
      render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(mockCloudSettings.shouldAllowSync).toHaveBeenCalled();
      });
    });

    it('should show validation warning for invalid combinations', async () => {
      mockCloudSettings.shouldAllowSync.mockResolvedValue({
        allowed: false,
        reason: 'WiFi-only mode but on cellular',
      });
      mockNetworkMonitor.getCurrentNetworkType.mockReturnValue('CELLULAR');

      const { getByText } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(getByText(/WiFi-only mode but on cellular/)).toBeTruthy();
      });
    });

    it('should validate after each setting change', async () => {
      const { getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        const wifiOnlySwitch = getByTestId('wifi-only-switch');
        fireEvent(wifiOnlySwitch, 'valueChange', true);
      });

      await waitFor(() => {
        expect(mockCloudSettings.shouldAllowSync).toHaveBeenCalledTimes(2); // Initial load + after change
      });
    });
  });

  describe('Status indicators', () => {
    it('should show sync status when sync is allowed', async () => {
      const { getByText, getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('sync-status-indicator')).toBeTruthy();
        expect(getByText('Ready to sync')).toBeTruthy();
      });
    });

    it('should show blocked status when sync is not allowed', async () => {
      mockCloudSettings.shouldAllowSync.mockResolvedValue({
        allowed: false,
        reason: 'No network connection',
      });

      const { getByText, getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('sync-status-indicator')).toBeTruthy();
        expect(getByText('Sync blocked')).toBeTruthy();
        expect(getByText('No network connection')).toBeTruthy();
      });
    });

    it('should show paused status when sync is paused', async () => {
      const pausedSettings = { ...defaultSettings, paused: true };
      mockCloudSettings.getSettings.mockResolvedValue(pausedSettings);

      const { getByText, getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('sync-status-indicator')).toBeTruthy();
        expect(getByText('Sync paused')).toBeTruthy();
      });
    });

    it('should update status indicators in real-time', async () => {
      const { getByTestId, getByText, rerender } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(getByText('Ready to sync')).toBeTruthy();
      });

      // Pause sync
      await waitFor(() => {
        const pauseSyncSwitch = getByTestId('pause-sync-switch');
        fireEvent(pauseSyncSwitch, 'valueChange', true);
      });

      await waitFor(() => {
        expect(getByText('Sync paused')).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    it('should provide accessibility labels for all switches', async () => {
      const { getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        const autoSyncSwitch = getByTestId('auto-sync-switch');
        const wifiOnlySwitch = getByTestId('wifi-only-switch');
        const pauseSyncSwitch = getByTestId('pause-sync-switch');

        expect(autoSyncSwitch.props.accessibilityLabel).toBeDefined();
        expect(wifiOnlySwitch.props.accessibilityLabel).toBeDefined();
        expect(pauseSyncSwitch.props.accessibilityLabel).toBeDefined();
      });
    });

    it('should provide accessibility hints for switches', async () => {
      const { getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        const autoSyncSwitch = getByTestId('auto-sync-switch');
        expect(autoSyncSwitch.props.accessibilityHint).toContain('uploads recordings');
      });
    });

    it('should announce state changes to screen readers', async () => {
      const { getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        const autoSyncSwitch = getByTestId('auto-sync-switch');
        fireEvent(autoSyncSwitch, 'valueChange', false);
      });

      await waitFor(() => {
        const autoSyncSwitch = getByTestId('auto-sync-switch');
        expect(autoSyncSwitch.props.accessibilityValue).toEqual({
          text: 'disabled',
        });
      });
    });

    it('should group related settings for screen readers', async () => {
      const { getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        const settingsGroup = getByTestId('sync-settings-group');
        expect(settingsGroup.props.accessibilityRole).toBe('group');
        expect(settingsGroup.props.accessibilityLabel).toBe('Sync settings');
      });
    });
  });

  describe('Network awareness', () => {
    it('should show network type information', async () => {
      mockNetworkMonitor.getCurrentNetworkType.mockReturnValue('WIFI');
      
      const { getByText } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(getByText(/Currently on: WiFi/)).toBeTruthy();
      });
    });

    it('should update network information when network changes', async () => {
      const { getByText, rerender } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(getByText(/Currently on: WiFi/)).toBeTruthy();
      });

      // Simulate network change
      mockNetworkMonitor.getCurrentNetworkType.mockReturnValue('CELLULAR');
      rerender(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(getByText(/Currently on: Cellular/)).toBeTruthy();
      });
    });

    it('should warn about cellular usage when appropriate', async () => {
      mockNetworkMonitor.getCurrentNetworkType.mockReturnValue('CELLULAR');
      const settings = { ...defaultSettings, wifiOnly: false };
      mockCloudSettings.getSettings.mockResolvedValue(settings);

      const { getByText } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(getByText(/This may use cellular data/)).toBeTruthy();
      });
    });

    it('should hide cellular warning when on WiFi', async () => {
      mockNetworkMonitor.getCurrentNetworkType.mockReturnValue('WIFI');

      const { queryByText } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(queryByText(/This may use cellular data/)).toBeNull();
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle missing settings gracefully', async () => {
      mockCloudSettings.getSettings.mockResolvedValue(null as any);

      const { getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        const autoSyncSwitch = getByTestId('auto-sync-switch');
        expect(autoSyncSwitch.props.value).toBe(false); // Default fallback
      });
    });

    it('should handle corrupted settings data', async () => {
      mockCloudSettings.getSettings.mockRejectedValue(new Error('Corrupted data'));

      const { getByText } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(getByText(/Failed to load settings/)).toBeTruthy();
      });
    });

    it('should handle rapid toggle events', async () => {
      const { getByTestId } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        const autoSyncSwitch = getByTestId('auto-sync-switch');
        
        // Rapid fire toggles
        fireEvent(autoSyncSwitch, 'valueChange', false);
        fireEvent(autoSyncSwitch, 'valueChange', true);
        fireEvent(autoSyncSwitch, 'valueChange', false);
      });

      // Should only persist the final state
      expect(mockCloudSettings.updateSettings).toHaveBeenCalledWith({
        autoSyncEnabled: false,
      });
    });

    it('should handle no network scenario', async () => {
      mockNetworkMonitor.getCurrentNetworkType.mockReturnValue('NONE');
      mockCloudSettings.shouldAllowSync.mockResolvedValue({
        allowed: false,
        reason: 'No network connection',
      });

      const { getByText } = render(<CloudSettingsScreen />);

      await waitFor(() => {
        expect(getByText('No network connection')).toBeTruthy();
        expect(getByText(/Currently on: No connection/)).toBeTruthy();
      });
    });
  });
});