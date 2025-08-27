import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import { PermissionGate } from '../../record/PermissionGate';
import { PermissionsManager, PermissionStatus } from '../../../lib/permissions';

jest.mock('../../../lib/permissions', () => ({
  PermissionsManager: {
    getRecordingPermission: jest.fn(),
    requestRecordingPermission: jest.fn(),
  },
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
}));

// Mocks are now handled in jest-setup.js

const mockPermissionsManager = PermissionsManager as jest.Mocked<typeof PermissionsManager>;
const mockAlert = Alert as jest.Mocked<typeof Alert>;
const mockLinking = Linking as jest.Mocked<typeof Linking>;

describe('PermissionGate', () => {
  const MockChild = () => <div data-testid="mock-child">Mock Child Content</div>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loading state', () => {
    it('should show loading state initially', () => {
      mockPermissionsManager.getRecordingPermission.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <PermissionGate>
          <MockChild />
        </PermissionGate>
      );

      expect(screen.getByText('Checking permissions...')).toBeTruthy();
    });
  });

  describe('granted permission', () => {
    it('should render children when permission is granted', async () => {
      mockPermissionsManager.getRecordingPermission.mockResolvedValue({
        status: PermissionStatus.GRANTED,
        canAskAgain: false,
      });

      render(
        <PermissionGate>
          <MockChild />
        </PermissionGate>
      );

      await waitFor(() => {
        expect(screen.getByTestId('mock-child')).toBeTruthy();
      });
    });
  });

  describe('undetermined permission', () => {
    it('should show request permission UI for undetermined permission', async () => {
      mockPermissionsManager.getRecordingPermission.mockResolvedValue({
        status: PermissionStatus.UNDETERMINED,
        canAskAgain: true,
      });

      render(
        <PermissionGate>
          <MockChild />
        </PermissionGate>
      );

      await waitFor(() => {
        expect(screen.getByText('Microphone Permission Required')).toBeTruthy();
        expect(screen.getByText('This app needs access to your microphone to record audio.')).toBeTruthy();
        expect(screen.getByText('Grant Permission')).toBeTruthy();
      });
    });

    it('should request permission when Grant Permission is pressed', async () => {
      mockPermissionsManager.getRecordingPermission.mockResolvedValue({
        status: PermissionStatus.UNDETERMINED,
        canAskAgain: true,
      });
      mockPermissionsManager.requestRecordingPermission.mockResolvedValue({
        status: PermissionStatus.GRANTED,
        canAskAgain: false,
      });

      render(
        <PermissionGate>
          <MockChild />
        </PermissionGate>
      );

      await waitFor(() => {
        expect(screen.getByText('Grant Permission')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Grant Permission'));

      await waitFor(() => {
        expect(mockPermissionsManager.requestRecordingPermission).toHaveBeenCalled();
      });
    });

    it('should show Check Again button', async () => {
      mockPermissionsManager.getRecordingPermission.mockResolvedValue({
        status: PermissionStatus.UNDETERMINED,
        canAskAgain: true,
      });

      render(
        <PermissionGate>
          <MockChild />
        </PermissionGate>
      );

      await waitFor(() => {
        expect(screen.getByText('Check Again')).toBeTruthy();
      });
    });

    it('should check permission again when Check Again is pressed', async () => {
      mockPermissionsManager.getRecordingPermission
        .mockResolvedValueOnce({
          status: PermissionStatus.UNDETERMINED,
          canAskAgain: true,
        })
        .mockResolvedValueOnce({
          status: PermissionStatus.GRANTED,
          canAskAgain: false,
        });

      render(
        <PermissionGate>
          <MockChild />
        </PermissionGate>
      );

      await waitFor(() => {
        expect(screen.getByText('Check Again')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Check Again'));

      await waitFor(() => {
        expect(mockPermissionsManager.getRecordingPermission).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('denied permission', () => {
    it('should show denied permission UI when can ask again', async () => {
      mockPermissionsManager.getRecordingPermission.mockResolvedValue({
        status: PermissionStatus.DENIED,
        canAskAgain: true,
      });

      render(
        <PermissionGate>
          <MockChild />
        </PermissionGate>
      );

      await waitFor(() => {
        expect(screen.getByText('Microphone Access Denied')).toBeTruthy();
        expect(screen.getByText('Please grant microphone access to record audio.')).toBeTruthy();
        expect(screen.getByText('Grant Permission')).toBeTruthy();
      });
    });

    it('should show settings UI when cannot ask again', async () => {
      mockPermissionsManager.getRecordingPermission.mockResolvedValue({
        status: PermissionStatus.DENIED,
        canAskAgain: false,
      });

      render(
        <PermissionGate>
          <MockChild />
        </PermissionGate>
      );

      await waitFor(() => {
        expect(screen.getByText('Microphone Access Denied')).toBeTruthy();
        expect(screen.getByText('Microphone access was denied. Enable it in Settings to continue.')).toBeTruthy();
        expect(screen.getByText('Open Settings')).toBeTruthy();
      });
    });

    it('should open settings when Open Settings is pressed', async () => {
      mockPermissionsManager.getRecordingPermission.mockResolvedValue({
        status: PermissionStatus.DENIED,
        canAskAgain: false,
      });

      render(
        <PermissionGate>
          <MockChild />
        </PermissionGate>
      );

      await waitFor(() => {
        expect(screen.getByText('Open Settings')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Open Settings'));

      expect(mockLinking.openSettings).toHaveBeenCalled();
    });

    it('should not show Check Again button when cannot ask again', async () => {
      mockPermissionsManager.getRecordingPermission.mockResolvedValue({
        status: PermissionStatus.DENIED,
        canAskAgain: false,
      });

      render(
        <PermissionGate>
          <MockChild />
        </PermissionGate>
      );

      await waitFor(() => {
        expect(screen.getByText('Open Settings')).toBeTruthy();
      });

      expect(screen.queryByText('Check Again')).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle permission request errors', async () => {
      mockPermissionsManager.getRecordingPermission.mockResolvedValue({
        status: PermissionStatus.UNDETERMINED,
        canAskAgain: true,
      });
      mockPermissionsManager.requestRecordingPermission.mockRejectedValue(
        new Error('Request failed')
      );

      render(
        <PermissionGate>
          <MockChild />
        </PermissionGate>
      );

      await waitFor(() => {
        expect(screen.getByText('Grant Permission')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Grant Permission'));

      await waitFor(() => {
        expect(mockAlert.alert).toHaveBeenCalledWith('Error', 'Failed to request microphone permission');
      });
    });

    it('should show alert for denied permission that cannot ask again after request', async () => {
      mockPermissionsManager.getRecordingPermission.mockResolvedValue({
        status: PermissionStatus.UNDETERMINED,
        canAskAgain: true,
      });
      mockPermissionsManager.requestRecordingPermission.mockResolvedValue({
        status: PermissionStatus.DENIED,
        canAskAgain: false,
      });

      render(
        <PermissionGate>
          <MockChild />
        </PermissionGate>
      );

      await waitFor(() => {
        expect(screen.getByText('Grant Permission')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Grant Permission'));

      await waitFor(() => {
        expect(mockAlert.alert).toHaveBeenCalledWith(
          'Permission Required',
          'Microphone access is required to record audio. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: expect.any(Function) },
          ]
        );
      });
    });
  });
});