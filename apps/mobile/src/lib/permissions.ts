import { Audio } from 'expo-av';

export enum PermissionStatus {
  GRANTED = 'granted',
  DENIED = 'denied',
  UNDETERMINED = 'undetermined',
}

export interface PermissionResult {
  status: PermissionStatus;
  canAskAgain: boolean;
}

export class PermissionsManager {
  static async getRecordingPermission(): Promise<PermissionResult> {
    try {
      const permission = await Audio.getPermissionsAsync();
      
      return {
        status: permission.granted 
          ? PermissionStatus.GRANTED 
          : permission.canAskAgain 
            ? PermissionStatus.UNDETERMINED 
            : PermissionStatus.DENIED,
        canAskAgain: permission.canAskAgain,
      };
    } catch (error) {
      console.error('Failed to check recording permission:', error);
      return {
        status: PermissionStatus.DENIED,
        canAskAgain: false,
      };
    }
  }

  static async requestRecordingPermission(): Promise<PermissionResult> {
    try {
      const permission = await Audio.requestPermissionsAsync();
      
      return {
        status: permission.granted 
          ? PermissionStatus.GRANTED 
          : PermissionStatus.DENIED,
        canAskAgain: permission.canAskAgain,
      };
    } catch (error) {
      console.error('Failed to request recording permission:', error);
      return {
        status: PermissionStatus.DENIED,
        canAskAgain: false,
      };
    }
  }
}