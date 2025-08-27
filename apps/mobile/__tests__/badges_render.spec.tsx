import React from 'react';
import { render } from '@testing-library/react-native';
import { SyncBadge } from '../src/components/library/SyncBadge';
import type { SyncStatus } from '../src/lib/sync/types';

// Mock theme hook
jest.mock('../src/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        textSecondary: '#666',
        surface: '#fff',
      },
      spacing: {
        xs: 4,
        sm: 8,
      },
      typography: {
        sizes: {
          xs: 12,
          sm: 14,
        },
        weights: {
          medium: '500',
        },
      },
    },
  }),
}));

describe('SyncBadge', () => {
  const renderBadge = (status: SyncStatus, props?: Partial<typeof SyncBadge.arguments>) => {
    return render(
      <SyncBadge
        status={status}
        size="medium"
        showText={true}
        {...props}
      />
    );
  };

  describe('Visual rendering', () => {
    it('should render synced status correctly', () => {
      const { getByText, getByLabelText } = renderBadge('synced');
      
      expect(getByText('Synced')).toBeTruthy();
      expect(getByLabelText('Cloud status: synced')).toBeTruthy();
    });

    it('should render uploading status with progress', () => {
      const { getByText, getByLabelText } = renderBadge('uploading', { progress: 45 });
      
      expect(getByText('45%')).toBeTruthy();
      expect(getByLabelText('Cloud status: uploading 45%')).toBeTruthy();
    });

    it('should render uploading status without progress', () => {
      const { getByText, getByLabelText } = renderBadge('uploading');
      
      expect(getByText('Uploading...')).toBeTruthy();
      expect(getByLabelText('Cloud status: uploading')).toBeTruthy();
    });

    it('should render queued status correctly', () => {
      const { getByText, getByLabelText } = renderBadge('queued');
      
      expect(getByText('Queued')).toBeTruthy();
      expect(getByLabelText('Cloud status: queued')).toBeTruthy();
    });

    it('should render failed status correctly', () => {
      const { getByText, getByLabelText } = renderBadge('failed');
      
      expect(getByText('Failed')).toBeTruthy();
      expect(getByLabelText('Cloud status: failed')).toBeTruthy();
    });

    it('should not render local status (returns null)', () => {
      const { container } = renderBadge('local');
      
      expect(container.children).toHaveLength(0);
    });
  });

  describe('Size variations', () => {
    it('should render small badge correctly', () => {
      const { getByLabelText } = renderBadge('synced', { size: 'small' });
      
      const badge = getByLabelText('Cloud status: synced');
      expect(badge).toBeTruthy();
    });

    it('should render medium badge correctly', () => {
      const { getByLabelText } = renderBadge('synced', { size: 'medium' });
      
      const badge = getByLabelText('Cloud status: synced');
      expect(badge).toBeTruthy();
    });
  });

  describe('Text display options', () => {
    it('should show text when showText=true', () => {
      const { getByText } = renderBadge('synced', { showText: true });
      
      expect(getByText('Synced')).toBeTruthy();
    });

    it('should hide text when showText=false', () => {
      const { queryByText, getByLabelText } = renderBadge('synced', { showText: false });
      
      expect(queryByText('Synced')).toBeNull();
      expect(getByLabelText('Cloud status: synced')).toBeTruthy();
    });
  });

  describe('Progress display', () => {
    it('should show percentage for uploading with progress', () => {
      const { getByText } = renderBadge('uploading', { progress: 75 });
      
      expect(getByText('75%')).toBeTruthy();
    });

    it('should round progress percentage', () => {
      const { getByText } = renderBadge('uploading', { progress: 33.7 });
      
      expect(getByText('34%')).toBeTruthy();
    });

    it('should handle 0% progress', () => {
      const { getByText } = renderBadge('uploading', { progress: 0 });
      
      expect(getByText('0%')).toBeTruthy();
    });

    it('should handle 100% progress', () => {
      const { getByText } = renderBadge('uploading', { progress: 100 });
      
      expect(getByText('100%')).toBeTruthy();
    });

    it('should ignore progress for non-uploading statuses', () => {
      const { getByText, queryByText } = renderBadge('queued', { progress: 50 });
      
      expect(getByText('Queued')).toBeTruthy();
      expect(queryByText('50%')).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('should have correct accessibility role', () => {
      const { getByRole } = renderBadge('synced');
      
      expect(getByRole('text')).toBeTruthy();
    });

    it('should provide meaningful accessibility labels for all statuses', () => {
      const statuses: SyncStatus[] = ['synced', 'uploading', 'queued', 'failed'];
      
      statuses.forEach(status => {
        const { getByLabelText } = renderBadge(status);
        const label = getByLabelText(new RegExp(`Cloud status: ${status}`));
        expect(label).toBeTruthy();
      });
    });

    it('should include progress in accessibility label for uploading', () => {
      const { getByLabelText } = renderBadge('uploading', { progress: 60 });
      
      expect(getByLabelText('Cloud status: uploading 60%')).toBeTruthy();
    });

    it('should be accessible to screen readers', () => {
      const { getByLabelText } = renderBadge('failed');
      
      const badge = getByLabelText('Cloud status: failed');
      expect(badge.props.accessibilityRole).toBe('text');
    });
  });

  describe('Color and styling', () => {
    it('should apply correct colors for each status', () => {
      const statuses: Array<{ status: SyncStatus; expectedColor: string }> = [
        { status: 'synced', expectedColor: '#10B981' },
        { status: 'uploading', expectedColor: '#F59E0B' },
        { status: 'queued', expectedColor: '#6B7280' },
        { status: 'failed', expectedColor: '#EF4444' },
      ];

      statuses.forEach(({ status }) => {
        const { getByLabelText } = renderBadge(status);
        const badge = getByLabelText(`Cloud status: ${status}`);
        expect(badge).toBeTruthy();
      });
    });

    it('should apply correct background colors for each status', () => {
      const statuses: Array<{ status: SyncStatus; expectedBg: string }> = [
        { status: 'synced', expectedBg: '#ECFDF5' },
        { status: 'uploading', expectedBg: '#FFFBEB' },
        { status: 'queued', expectedBg: '#F9FAFB' },
        { status: 'failed', expectedBg: '#FEF2F2' },
      ];

      statuses.forEach(({ status }) => {
        const { getByLabelText } = renderBadge(status);
        const badge = getByLabelText(`Cloud status: ${status}`);
        expect(badge).toBeTruthy();
      });
    });
  });

  describe('Icon display', () => {
    it('should show correct icons for each status', () => {
      const statuses: Array<{ status: SyncStatus; expectedIcon: string }> = [
        { status: 'synced', expectedIcon: 'cloud-done' },
        { status: 'uploading', expectedIcon: 'cloud-upload' },
        { status: 'queued', expectedIcon: 'time' },
        { status: 'failed', expectedIcon: 'cloud-offline' },
      ];

      statuses.forEach(({ status }) => {
        const { getByLabelText } = renderBadge(status);
        expect(getByLabelText(`Cloud status: ${status}`)).toBeTruthy();
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined progress gracefully', () => {
      const { getByText } = renderBadge('uploading', { progress: undefined });
      
      expect(getByText('Uploading...')).toBeTruthy();
    });

    it('should handle negative progress', () => {
      const { getByText } = renderBadge('uploading', { progress: -10 });
      
      expect(getByText('-10%')).toBeTruthy();
    });

    it('should handle progress over 100%', () => {
      const { getByText } = renderBadge('uploading', { progress: 150 });
      
      expect(getByText('150%')).toBeTruthy();
    });

    it('should handle very small progress values', () => {
      const { getByText } = renderBadge('uploading', { progress: 0.1 });
      
      expect(getByText('0%')).toBeTruthy();
    });
  });
});