import { create } from 'zustand';
import { MetaStore, Folder } from '../fs/metaStore';

export interface FoldersState {
  folders: Folder[];
  loading: boolean;
  error?: string;
}

export interface FoldersActions {
  loadFolders: () => Promise<void>;
  createFolder: (name: string, parentId?: string) => Promise<Folder>;
  updateFolder: (id: string, updates: Partial<Pick<Folder, 'name'>>) => Promise<void>;
  deleteFolder: (id: string) => Promise<{ canDelete: boolean; reason?: string }>;
  getFolder: (id: string) => Folder | undefined;
  getFoldersByParent: (parentId: string | null) => Folder[];
  getFolderUsageCount: (folderId: string) => Promise<{ recordings: number; subfolders: number }>;
  getRootFolders: () => Folder[];
  getFolderPath: (folderId: string) => Folder[];
}

type FoldersStore = FoldersState & FoldersActions;

const generateId = (): string => Date.now().toString();

const validateFolderName = (name: string, existingFolders: Folder[], parentId?: string): void => {
  if (!name.trim()) {
    throw new Error('Folder name cannot be empty');
  }

  // Check for duplicate names within the same parent
  const siblings = existingFolders.filter(f => f.parentId === (parentId || null));
  const duplicate = siblings.find(f => f.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    throw new Error('A folder with this name already exists');
  }
};

const validateFolderDepth = (parentId: string | undefined, folders: Folder[]): void => {
  if (!parentId) return; // Root level is always allowed

  const parent = folders.find(f => f.id === parentId);
  if (!parent) {
    throw new Error('Parent folder not found');
  }

  if (parent.parentId !== null) {
    throw new Error('Cannot create folders more than 2 levels deep');
  }
};

export const useFolders = create<FoldersStore>((set, get) => ({
  folders: [],
  loading: false,
  error: undefined,

  loadFolders: async () => {
    try {
      set({ loading: true, error: undefined });
      const folders = await MetaStore.readFolders();
      set({ folders, loading: false });
    } catch (error) {
      console.error('Failed to load folders:', error);
      set({
        folders: [],
        loading: false,
        error: 'Failed to load folders',
      });
    }
  },

  createFolder: async (name: string, parentId?: string) => {
    const { folders } = get();
    
    try {
      // Check if folder with this name already exists in this parent
      const siblings = folders.filter(f => f.parentId === (parentId || null));
      const duplicate = siblings.find(f => f.name.toLowerCase() === name.trim().toLowerCase());
      if (duplicate) {
        console.log('FOLDERS: Folder already exists, skipping creation:', { name: name.trim(), parentId });
        return duplicate; // Return existing folder instead of throwing error
      }

      validateFolderName(name, folders, parentId);
      validateFolderDepth(parentId, folders);

      const newFolder: Folder = {
        id: generateId(),
        name: name.trim(),
        parentId: parentId || null,
      };

      const updatedFolders = [...folders, newFolder];
      await MetaStore.writeFolders(updatedFolders);
      
      set({ folders: updatedFolders });
      console.log('FOLDERS: Created folder:', newFolder);
      
      return newFolder;
    } catch (error) {
      console.error('Failed to create folder:', error);
      throw error;
    }
  },

  updateFolder: async (id: string, updates: Partial<Pick<Folder, 'name'>>) => {
    const { folders } = get();
    const folder = folders.find(f => f.id === id);
    
    if (!folder) {
      throw new Error('Folder not found');
    }

    try {
      if (updates.name) {
        const otherFolders = folders.filter(f => f.id !== id);
        validateFolderName(updates.name, otherFolders, folder.parentId || undefined);
      }

      const updatedFolder = { ...folder, ...updates };
      const updatedFolders = folders.map(f => f.id === id ? updatedFolder : f);
      
      await MetaStore.writeFolders(updatedFolders);
      set({ folders: updatedFolders });
      
      console.log('FOLDERS: Updated folder:', updatedFolder);
    } catch (error) {
      console.error('Failed to update folder:', error);
      throw error;
    }
  },

  deleteFolder: async (id: string) => {
    const { folders } = get();
    const folder = folders.find(f => f.id === id);
    
    if (!folder) {
      throw new Error('Folder not found');
    }

    try {
      const usage = await get().getFolderUsageCount(id);
      
      if (usage.subfolders > 0) {
        return {
          canDelete: false,
          reason: `Cannot delete folder "${folder.name}" because it contains ${usage.subfolders} subfolder${usage.subfolders === 1 ? '' : 's'}`,
        };
      }

      if (usage.recordings > 0) {
        return {
          canDelete: false,
          reason: `Cannot delete folder "${folder.name}" because it contains ${usage.recordings} recording${usage.recordings === 1 ? '' : 's'}`,
        };
      }

      const updatedFolders = folders.filter(f => f.id !== id);
      await MetaStore.writeFolders(updatedFolders);
      
      set({ folders: updatedFolders });
      console.log('FOLDERS: Deleted folder:', folder);
      
      return { canDelete: true };
    } catch (error) {
      console.error('Failed to delete folder:', error);
      throw error;
    }
  },

  getFolder: (id: string) => {
    return get().folders.find(f => f.id === id);
  },

  getFoldersByParent: (parentId: string | null) => {
    return get().folders.filter(f => f.parentId === parentId);
  },

  getFolderUsageCount: async (folderId: string) => {
    const { folders } = get();
    
    // Count subfolders
    const subfolders = folders.filter(f => f.parentId === folderId).length;
    
    // Count recordings - for now return 0 to avoid circular dependency
    // This will be resolved when the folder usage count is called from UI components
    // that already have access to recordings
    let recordings = 0;

    return { recordings, subfolders };
  },

  getRootFolders: () => {
    return get().folders.filter(f => f.parentId === null);
  },

  getFolderPath: (folderId: string) => {
    const { folders, getFolder } = get();
    const path: Folder[] = [];
    let current = getFolder(folderId);
    
    while (current) {
      path.unshift(current);
      current = current.parentId ? getFolder(current.parentId) : undefined;
    }
    
    return path;
  },
}));