import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { RecordingItem } from '../src/components/library/RecordingItem';
import { SyncManager } from '../src/lib/sync/SyncManager';
import type { RecordingEntry } from '../src/lib/fs/indexStore';
import type { SyncStatus } from '../src/lib/sync/types';

// Mock dependencies
jest.mock('../src/lib/sync/SyncManager');
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
      },
      spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
      },
      typography: {
        sizes: {
          sm: 14,
          md: 16,
        },
        weights: {
          normal: '400',
          medium: '500',
          bold: '600',
        },
      },
    },
  }),
}));

const mockSyncManager = SyncManager as jest.Mocked<typeof SyncManager>;
const mockGetInstance = jest.fn();
const mockRetryRecording = jest.fn();
const mockGetRecordingStatus = jest.fn();

mockSyncManager.getInstance = mockGetInstance;

describe('Long Press Retry Functionality', () => {
  let mockRecording: RecordingEntry;
  let mockSyncManagerInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    Alert.alert = jest.fn();

    mockRecording = {
      id: 'test_recording_123',
      title: 'Test Recording',
      filePath: '/path/to/recording.m4a',
      durationSec: 120,
      createdAt: '2024-01-01T10:00:00.000Z',
      updatedAt: '2024-01-01T10:02:00.000Z',
      size: 1024000,
      folderId: null,
      tags: []
    };

    mockSyncManagerInstance = {
      retryRecording: mockRetryRecording,
      getRecordingStatus: mockGetRecordingStatus,
    };

    mockGetInstance.mockReturnValue(mockSyncManagerInstance);
  });

  describe('Long press detection', () => {
    it('should trigger long press after 500ms hold', async () => {
      mockGetRecordingStatus.mockReturnValue('failed');
      
      const { getByTestId } = render(
        <RecordingItem 
          recording={mockRecording} 
          onPress={() => {}} 
          onLongPress={() => {}}
        />
      );

      const recordingItem = getByTestId('recording-item');
      
      fireEvent(recordingItem, 'onLongPress');
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });
    });

    it('should not trigger long press on short tap', async () => {
      mockGetRecordingStatus.mockReturnValue('failed');
      
      const { getByTestId } = render(
        <RecordingItem 
          recording={mockRecording} 
          onPress={() => {}} 
          onLongPress={() => {}}
        />
      );

      const recordingItem = getByTestId('recording-item');
      
      fireEvent.press(recordingItem);
      
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('should provide haptic feedback on long press', async () => {
      const mockHapticImpact = jest.fn();
      jest.doMock('expo-haptics', () => ({
        impactAsync: mockHapticImpact,
        ImpactFeedbackStyle: { Medium: 'medium' },
      }));

      mockGetRecordingStatus.mockReturnValue('failed');
      
      const { getByTestId } = render(
        <RecordingItem 
          recording={mockRecording} 
          onPress={() => {}} 
          onLongPress={() => {}}
        />
      );

      const recordingItem = getByTestId('recording-item');
      fireEvent(recordingItem, 'onLongPress');

      await waitFor(() => {
        expect(mockHapticImpact).toHaveBeenCalledWith('medium');
      });
    });
  });

  describe('Retry menu options', () => {
    it('should show retry option for failed recordings', async () => {
      mockGetRecordingStatus.mockReturnValue('failed');
      
      const { getByTestId } = render(
        <RecordingItem 
          recording={mockRecording} 
          onPress={() => {}} 
          onLongPress={() => {}}
        />
      );

      const recordingItem = getByTestId('recording-item');
      fireEvent(recordingItem, 'onLongPress');

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Recording Options',
          expect.any(String),
          expect.arrayContaining([
            expect.objectContaining({
              text: 'Retry Upload',
              onPress: expect.any(Function),
            }),
          ])
        );
      });
    });

    it('should not show retry option for synced recordings', async () => {
      mockGetRecordingStatus.mockReturnValue('synced');
      
      const { getByTestId } = render(
        <RecordingItem 
          recording={mockRecording} 
          onPress={() => {}} 
          onLongPress={() => {}}
        />
      );

      const recordingItem = getByTestId('recording-item');
      fireEvent(recordingItem, 'onLongPress');

      await waitFor(() => {
        if (Alert.alert.mock.calls.length > 0) {
          const alertButtons = Alert.alert.mock.calls[0][2];
          const retryButton = alertButtons?.find(btn => btn.text === 'Retry Upload');
          expect(retryButton).toBeUndefined();
        }
      });
    });

    it('should not show retry option for uploading recordings', async () => {
      mockGetRecordingStatus.mockReturnValue('uploading');
      
      const { getByTestId } = render(
        <RecordingItem 
          recording={mockRecording} 
          onPress={() => {}} 
          onLongPress={() => {}}
        />
      );

      const recordingItem = getByTestId('recording-item');
      fireEvent(recordingItem, 'onLongPress');

      await waitFor(() => {
        if (Alert.alert.mock.calls.length > 0) {
          const alertButtons = Alert.alert.mock.calls[0][2];
          const retryButton = alertButtons?.find(btn => btn.text === 'Retry Upload');
          expect(retryButton).toBeUndefined();
        }
      });
    });

    it('should show retry option for queued recordings that have failed before', async () => {
      mockGetRecordingStatus.mockReturnValue('queued');
      // Simulate that this recording has a previous failure
      mockSyncManagerInstance.getRecordingFailureCount = jest.fn().mockReturnValue(2);
      
      const { getByTestId } = render(
        <RecordingItem 
          recording={mockRecording} 
          onPress={() => {}} 
          onLongPress={() => {}}
        />
      );

      const recordingItem = getByTestId('recording-item');
      fireEvent(recordingItem, 'onLongPress');

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Recording Options',
          expect.any(String),
          expect.arrayContaining([
            expect.objectContaining({
              text: 'Retry Upload',
              onPress: expect.any(Function),
            }),
          ])
        );
      });
    });
  });

  describe('Retry execution', () => {
    it('should call SyncManager.retryRecording when retry is selected', async () => {
      mockGetRecordingStatus.mockReturnValue('failed');
      mockRetryRecording.mockResolvedValue();
      
      const { getByTestId } = render(
        <RecordingItem 
          recording={mockRecording} 
          onPress={() => {}} 
          onLongPress={() => {}}
        />
      );

      const recordingItem = getByTestId('recording-item');
      fireEvent(recordingItem, 'onLongPress');

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Simulate user selecting retry option
      const alertCall = Alert.alert.mock.calls[0];
      const buttons = alertCall[2];
      const retryButton = buttons?.find(btn => btn.text === 'Retry Upload');
      
      if (retryButton && retryButton.onPress) {
        retryButton.onPress();
      }

      await waitFor(() => {
        expect(mockRetryRecording).toHaveBeenCalledWith(mockRecording.id);
      });
    });

    it('should handle retry failures gracefully', async () => {
      mockGetRecordingStatus.mockReturnValue('failed');
      mockRetryRecording.mockRejectedValue(new Error('Network unavailable'));
      
      const { getByTestId } = render(
        <RecordingItem 
          recording={mockRecording} 
          onPress={() => {}} 
          onLongPress={() => {}}
        />
      );

      const recordingItem = getByTestId('recording-item');
      fireEvent(recordingItem, 'onLongPress');

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Simulate user selecting retry option
      const alertCall = Alert.alert.mock.calls[0];
      const buttons = alertCall[2];
      const retryButton = buttons?.find(btn => btn.text === 'Retry Upload');
      
      if (retryButton && retryButton.onPress) {
        retryButton.onPress();
      }

      await waitFor(() => {
        expect(mockRetryRecording).toHaveBeenCalledWith(mockRecording.id);
        // Should show error alert
        expect(Alert.alert).toHaveBeenCalledTimes(2);
      });
    });

    it('should show success feedback after successful retry', async () => {
      mockGetRecordingStatus.mockReturnValue('failed');
      mockRetryRecording.mockResolvedValue();
      
      const { getByTestId } = render(
        <RecordingItem 
          recording={mockRecording} 
          onPress={() => {}} 
          onLongPress={() => {}}
        />
      );

      const recordingItem = getByTestId('recording-item');
      fireEvent(recordingItem, 'onLongPress');

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Simulate user selecting retry option
      const alertCall = Alert.alert.mock.calls[0];
      const buttons = alertCall[2];
      const retryButton = buttons?.find(btn => btn.text === 'Retry Upload');
      
      if (retryButton && retryButton.onPress) {
        retryButton.onPress();
      }

      await waitFor(() => {
        expect(mockRetryRecording).toHaveBeenCalledWith(mockRecording.id);
        // Should show success feedback
        expect(Alert.alert).toHaveBeenCalledWith(
          'Upload Queued',
          expect.stringContaining('will retry'),
          expect.any(Array)
        );
      });
    });
  });

  describe('Status-specific behavior', () => {
    const statuses: Array<{ status: SyncStatus; shouldShowRetry: boolean; description: string }> = [
      { status: 'local', shouldShowRetry: false, description: 'local recordings without sync enabled' },
      { status: 'queued', shouldShowRetry: false, description: 'queued recordings in normal flow' },
      { status: 'uploading', shouldShowRetry: false, description: 'currently uploading recordings' },
      { status: 'synced', shouldShowRetry: false, description: 'successfully synced recordings' },
      { status: 'failed', shouldShowRetry: true, description: 'failed recordings needing retry' },
    ];

    statuses.forEach(({ status, shouldShowRetry, description }) => {
      it(`should ${shouldShowRetry ? 'show' : 'hide'} retry option for ${description}`, async () => {
        mockGetRecordingStatus.mockReturnValue(status);
        
        const { getByTestId } = render(
          <RecordingItem 
            recording={mockRecording} 
            onPress={() => {}} 
            onLongPress={() => {}}
          />
        );

        const recordingItem = getByTestId('recording-item');
        fireEvent(recordingItem, 'onLongPress');

        await waitFor(() => {
          if (shouldShowRetry) {
            expect(Alert.alert).toHaveBeenCalledWith(
              'Recording Options',
              expect.any(String),
              expect.arrayContaining([
                expect.objectContaining({
                  text: 'Retry Upload',
                }),
              ])
            );
          } else {
            if (Alert.alert.mock.calls.length > 0) {
              const alertButtons = Alert.alert.mock.calls[0][2];
              const retryButton = alertButtons?.find(btn => btn.text === 'Retry Upload');
              expect(retryButton).toBeUndefined();
            }
          }
        });
      });
    });
  });

  describe('Accessibility', () => {
    it('should provide accessibility hints for long press', () => {
      mockGetRecordingStatus.mockReturnValue('failed');
      
      const { getByTestId } = render(
        <RecordingItem 
          recording={mockRecording} 
          onPress={() => {}} 
          onLongPress={() => {}}
        />
      );

      const recordingItem = getByTestId('recording-item');
      
      expect(recordingItem.props.accessibilityHint).toContain('long press');
    });

    it('should announce retry availability for failed recordings', () => {
      mockGetRecordingStatus.mockReturnValue('failed');
      
      const { getByTestId } = render(
        <RecordingItem 
          recording={mockRecording} 
          onPress={() => {}} 
          onLongPress={() => {}}
        />
      );

      const recordingItem = getByTestId('recording-item');
      
      expect(recordingItem.props.accessibilityLabel).toContain('retry available');
    });

    it('should have proper accessibility role for interactive element', () => {
      const { getByTestId } = render(
        <RecordingItem 
          recording={mockRecording} 
          onPress={() => {}} 
          onLongPress={() => {}}
        />
      );

      const recordingItem = getByTestId('recording-item');
      
      expect(recordingItem.props.accessibilityRole).toBe('button');
    });
  });

  describe('Edge cases', () => {
    it('should handle concurrent long presses gracefully', async () => {
      mockGetRecordingStatus.mockReturnValue('failed');
      
      const { getByTestId } = render(
        <RecordingItem 
          recording={mockRecording} 
          onPress={() => {}} 
          onLongPress={() => {}}
        />
      );

      const recordingItem = getByTestId('recording-item');
      
      // Simulate rapid long presses
      fireEvent(recordingItem, 'onLongPress');
      fireEvent(recordingItem, 'onLongPress');
      fireEvent(recordingItem, 'onLongPress');

      await waitFor(() => {
        // Should only show one alert despite multiple triggers
        expect(Alert.alert).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle SyncManager unavailable scenario', async () => {
      mockGetInstance.mockReturnValue(null);
      
      const { getByTestId } = render(
        <RecordingItem 
          recording={mockRecording} 
          onPress={() => {}} 
          onLongPress={() => {}}
        />
      );

      const recordingItem = getByTestId('recording-item');
      fireEvent(recordingItem, 'onLongPress');

      await waitFor(() => {
        // Should gracefully handle missing sync manager
        expect(Alert.alert).toHaveBeenCalledWith(
          'Sync Unavailable',
          expect.stringContaining('not available'),
          expect.any(Array)
        );
      });
    });

    it('should handle missing recording ID', async () => {
      const invalidRecording = { ...mockRecording, id: '' };
      
      const { getByTestId } = render(
        <RecordingItem 
          recording={invalidRecording} 
          onPress={() => {}} 
          onLongPress={() => {}}
        />
      );

      const recordingItem = getByTestId('recording-item');
      fireEvent(recordingItem, 'onLongPress');

      await waitFor(() => {
        // Should handle invalid recording gracefully
        expect(Alert.alert).not.toHaveBeenCalled();
      });
    });
  });
});