import { Audio } from 'expo-av';
import { PermissionsManager, PermissionStatus } from '../permissions';

jest.mock('expo-av', () => ({
  Audio: {
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
  },
}));

const mockedAudio = Audio as jest.Mocked<typeof Audio>;

describe('PermissionsManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRecordingPermission', () => {
    it('should return GRANTED status when permission is granted', async () => {
      mockedAudio.getPermissionsAsync.mockResolvedValue({
        granted: true,
        canAskAgain: false,
        status: 'granted',
        expires: 'never',
      });

      const result = await PermissionsManager.getRecordingPermission();

      expect(result).toEqual({
        status: PermissionStatus.GRANTED,
        canAskAgain: false,
      });
    });

    it('should return UNDETERMINED status when permission can be asked again', async () => {
      mockedAudio.getPermissionsAsync.mockResolvedValue({
        granted: false,
        canAskAgain: true,
        status: 'undetermined',
        expires: 'never',
      });

      const result = await PermissionsManager.getRecordingPermission();

      expect(result).toEqual({
        status: PermissionStatus.UNDETERMINED,
        canAskAgain: true,
      });
    });

    it('should return DENIED status when permission is denied', async () => {
      mockedAudio.getPermissionsAsync.mockResolvedValue({
        granted: false,
        canAskAgain: false,
        status: 'denied',
        expires: 'never',
      });

      const result = await PermissionsManager.getRecordingPermission();

      expect(result).toEqual({
        status: PermissionStatus.DENIED,
        canAskAgain: false,
      });
    });

    it('should handle errors gracefully', async () => {
      mockedAudio.getPermissionsAsync.mockRejectedValue(new Error('Permission error'));

      const result = await PermissionsManager.getRecordingPermission();

      expect(result).toEqual({
        status: PermissionStatus.DENIED,
        canAskAgain: false,
      });
    });
  });

  describe('requestRecordingPermission', () => {
    it('should return GRANTED status when permission is granted', async () => {
      mockedAudio.requestPermissionsAsync.mockResolvedValue({
        granted: true,
        canAskAgain: false,
        status: 'granted',
        expires: 'never',
      });

      const result = await PermissionsManager.requestRecordingPermission();

      expect(result).toEqual({
        status: PermissionStatus.GRANTED,
        canAskAgain: false,
      });
    });

    it('should return DENIED status when permission is denied', async () => {
      mockedAudio.requestPermissionsAsync.mockResolvedValue({
        granted: false,
        canAskAgain: true,
        status: 'denied',
        expires: 'never',
      });

      const result = await PermissionsManager.requestRecordingPermission();

      expect(result).toEqual({
        status: PermissionStatus.DENIED,
        canAskAgain: true,
      });
    });

    it('should handle errors gracefully', async () => {
      mockedAudio.requestPermissionsAsync.mockRejectedValue(new Error('Request error'));

      const result = await PermissionsManager.requestRecordingPermission();

      expect(result).toEqual({
        status: PermissionStatus.DENIED,
        canAskAgain: false,
      });
    });
  });
});