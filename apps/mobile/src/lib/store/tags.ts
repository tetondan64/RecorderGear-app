import { create } from 'zustand';
import { MetaStore, Tag } from '../fs/metaStore';

export interface TagsState {
  tags: Tag[];
  loading: boolean;
  error?: string;
}

export interface TagsActions {
  loadTags: () => Promise<void>;
  createTag: (name: string) => Promise<Tag>;
  updateTag: (id: string, updates: Partial<Pick<Tag, 'name'>>) => Promise<void>;
  deleteTag: (id: string) => Promise<{ canDelete: boolean; usageCount?: number }>;
  getTag: (id: string) => Tag | undefined;
  getTagUsageCount: (tagId: string) => Promise<number>;
  getTagsByIds: (ids: string[]) => Tag[];
}

type TagsStore = TagsState & TagsActions;

const generateId = (): string => Date.now().toString();

const validateTagName = (name: string, existingTags: Tag[], excludeId?: string): void => {
  if (!name.trim()) {
    throw new Error('Tag name cannot be empty');
  }

  // Check for duplicate names (case-insensitive)
  const duplicate = existingTags.find(
    t => t.id !== excludeId && t.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    throw new Error('A tag with this name already exists');
  }
};

export const useTags = create<TagsStore>((set, get) => ({
  tags: [],
  loading: false,
  error: undefined,

  loadTags: async () => {
    try {
      set({ loading: true, error: undefined });
      const tags = await MetaStore.readTags();
      set({ tags, loading: false });
    } catch (error) {
      console.error('Failed to load tags:', error);
      set({
        tags: [],
        loading: false,
        error: 'Failed to load tags',
      });
    }
  },

  createTag: async (name: string) => {
    const { tags } = get();
    
    try {
      // Check if tag with this name already exists
      const duplicate = tags.find(t => t.name.toLowerCase() === name.trim().toLowerCase());
      if (duplicate) {
        console.log('TAGS: Tag already exists, skipping creation:', { name: name.trim() });
        return duplicate; // Return existing tag instead of throwing error
      }

      validateTagName(name, tags);

      const newTag: Tag = {
        id: generateId(),
        name: name.trim(),
      };

      const updatedTags = [...tags, newTag];
      await MetaStore.writeTags(updatedTags);
      
      set({ tags: updatedTags });
      console.log('TAGS: Created tag:', newTag);
      
      return newTag;
    } catch (error) {
      console.error('Failed to create tag:', error);
      throw error;
    }
  },

  updateTag: async (id: string, updates: Partial<Pick<Tag, 'name'>>) => {
    const { tags } = get();
    const tag = tags.find(t => t.id === id);
    
    if (!tag) {
      throw new Error('Tag not found');
    }

    try {
      if (updates.name) {
        validateTagName(updates.name, tags, id);
      }

      const updatedTag = { ...tag, ...updates };
      const updatedTags = tags.map(t => t.id === id ? updatedTag : t);
      
      await MetaStore.writeTags(updatedTags);
      set({ tags: updatedTags });
      
      console.log('TAGS: Updated tag:', updatedTag);
    } catch (error) {
      console.error('Failed to update tag:', error);
      throw error;
    }
  },

  deleteTag: async (id: string) => {
    const { tags } = get();
    const tag = tags.find(t => t.id === id);
    
    if (!tag) {
      throw new Error('Tag not found');
    }

    try {
      const usageCount = await get().getTagUsageCount(id);
      
      if (usageCount > 0) {
        return {
          canDelete: false,
          usageCount,
        };
      }

      const updatedTags = tags.filter(t => t.id !== id);
      await MetaStore.writeTags(updatedTags);
      
      set({ tags: updatedTags });
      console.log('TAGS: Deleted tag:', tag);
      
      return { canDelete: true };
    } catch (error) {
      console.error('Failed to delete tag:', error);
      throw error;
    }
  },

  getTag: (id: string) => {
    return get().tags.find(t => t.id === id);
  },

  getTagUsageCount: async (tagId: string) => {
    // Count how many recordings use this tag - for now return 0 to avoid circular dependency
    // This will be resolved when the tag usage count is called from UI components
    // that already have access to recordings  
    let count = 0;
    return count;
  },

  getTagsByIds: (ids: string[]) => {
    const { tags } = get();
    return ids.map(id => tags.find(t => t.id === id)).filter(Boolean) as Tag[];
  },
  
  getTagNameById: (id: string) => {
    const { tags } = get();
    return tags.find(t => t.id === id)?.name;
  },
  
  getAllTagNames: () => {
    const { tags } = get();
    return tags.map(t => t.name);
  },
}));