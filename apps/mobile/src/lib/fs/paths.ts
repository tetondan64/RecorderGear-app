import * as FileSystem from 'expo-file-system';

export const RECORDINGS_DIR = `${FileSystem.documentDirectory}recordings/`;
export const INDEX_FILE_PATH = `${RECORDINGS_DIR}index.json`;

export const getRecordingPath = (id: string): string => {
  return `${RECORDINGS_DIR}${id}.m4a`;
};

export const ensureRecordingsDirectory = async (): Promise<void> => {
  const dirInfo = await FileSystem.getInfoAsync(RECORDINGS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
  }
};