import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/hooks/useTheme';
import { Toast } from '../../src/components/common/Toast';
import { SyncStatusPanel } from '../../src/components/sync/SyncStatusPanel';

interface SettingItemProps {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  value?: boolean;
  onToggle?: (value: boolean) => void;
  showArrow?: boolean;
}

function SettingItem({
  title,
  subtitle,
  icon,
  onPress,
  value,
  onToggle,
  showArrow = true,
}: SettingItemProps) {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    iconContainer: {
      width: 32,
      height: 32,
      borderRadius: 6,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.md,
    },
    content: {
      flex: 1,
    },
    title: {
      fontSize: theme.typography.sizes.md,
      fontWeight: theme.typography.weights.medium,
      color: theme.colors.text,
      marginBottom: subtitle ? theme.spacing.xs / 2 : 0,
    },
    subtitle: {
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.textSecondary,
    },
    rightContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
  });

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={onPress}
      disabled={!onPress && !onToggle}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={18} color={theme.colors.surface} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      <View style={styles.rightContent}>
        {onToggle && (
          <Switch
            value={value}
            onValueChange={onToggle}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.primary,
            }}
            thumbColor={theme.colors.surface}
          />
        )}
        {showArrow && !onToggle && (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.colors.textSecondary}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    section: {
      marginTop: theme.spacing.lg,
    },
    header: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    title: {
      fontSize: theme.typography.sizes.sm,
      fontWeight: theme.typography.weights.semibold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  });

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const { theme, colorScheme, toggleColorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [autoSaveEnabled, setAutoSaveEnabled] = React.useState(true);
  const [qualityMode, setQualityMode] = React.useState('High');
  
  // Cloud sync settings state
  const [autoSyncEnabled, setAutoSyncEnabled] = React.useState(true);
  const [wifiOnlySync, setWifiOnlySync] = React.useState(true);
  const [syncPaused, setSyncPaused] = React.useState(false);

  // Load sync settings on mount
  React.useEffect(() => {
    loadSyncSettings();
  }, []);

  const loadSyncSettings = async () => {
    try {
      const { syncSettings } = await import('../../src/lib/sync/SyncSettings');
      await syncSettings.load();
      const settings = await syncSettings.getSettings();
      
      setAutoSyncEnabled(settings.autoSyncEnabled);
      setWifiOnlySync(settings.wifiOnlySync);
      setSyncPaused(settings.syncPaused);
    } catch (error) {
      console.error('Failed to load sync settings:', error);
    }
  };

  // Save sync settings when they change
  React.useEffect(() => {
    saveSyncSetting('autoSyncEnabled', autoSyncEnabled);
  }, [autoSyncEnabled]);

  React.useEffect(() => {
    saveSyncSetting('wifiOnlySync', wifiOnlySync);
  }, [wifiOnlySync]);

  React.useEffect(() => {
    saveSyncSetting('syncPaused', syncPaused);
  }, [syncPaused]);

  const saveSyncSetting = async (key: string, value: boolean) => {
    try {
      const { syncSettings } = await import('../../src/lib/sync/SyncSettings');
      switch (key) {
        case 'autoSyncEnabled':
          await syncSettings.setAutoSyncEnabled(value);
          break;
        case 'wifiOnlySync':
          await syncSettings.setWifiOnlySync(value);
          break;
        case 'syncPaused':
          await syncSettings.setSyncPaused(value);
          break;
      }
    } catch (error) {
      console.error(`Failed to save sync setting ${key}:`, error);
    }
  };

  const handleAbout = () => {
    Alert.alert(
      'About RecorderGear',
      'Version 1.0.0 (Phase P0)\n\nA modern voice recording app built with React Native and Expo.\n\nPhase P0: Basic UI and navigation\nPhase P1: Recording functionality\nPhase P2: AI features',
      [{ text: 'OK' }]
    );
  };

  const handleQuality = () => {
    Alert.alert(
      'Audio Quality',
      'Choose your preferred recording quality',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Low', onPress: () => setQualityMode('Low') },
        { text: 'Medium', onPress: () => setQualityMode('Medium') },
        { text: 'High', onPress: () => setQualityMode('High') },
      ]
    );
  };

  const handleExport = () => {
    Alert.alert(
      'Export Data',
      'Export functionality will be available in Phase P1.',
      [{ text: 'OK' }]
    );
  };

  const handleSupport = () => {
    Alert.alert(
      'Support',
      'Need help? Contact our support team at support@recordergear.com',
      [{ text: 'OK' }]
    );
  };


  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingTop: insets.top, // Use safe area insets
    },
    header: {
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md, // Reduced since we handle safe area in container
      paddingBottom: theme.spacing.md,
    },
    title: {
      fontSize: theme.typography.sizes.xxxl,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.text,
      textAlign: 'center',
    },
    version: {
      textAlign: 'center',
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Section title="Appearance">
          <SettingItem
            title="Dark Mode"
            subtitle={`Currently using ${colorScheme} mode`}
            icon="moon"
            value={colorScheme === 'dark'}
            onToggle={toggleColorScheme}
            showArrow={false}
          />
        </Section>

        <Section title="Recording">
          <SettingItem
            title="Audio Quality"
            subtitle={`${qualityMode} quality recording`}
            icon="musical-note"
            onPress={handleQuality}
          />
          <SettingItem
            title="Auto-Save"
            subtitle="Automatically save recordings"
            icon="save"
            value={autoSaveEnabled}
            onToggle={setAutoSaveEnabled}
            showArrow={false}
          />
        </Section>

        <Section title="Notifications">
          <SettingItem
            title="Push Notifications"
            subtitle="Get notified about app updates"
            icon="notifications"
            value={notificationsEnabled}
            onToggle={setNotificationsEnabled}
            showArrow={false}
          />
        </Section>

        <Section title="Multi-Device Sync">
          <SyncStatusPanel showAdvanced={false} />
          <SettingItem
            title="WiFi only"
            subtitle="Only sync when connected to WiFi"
            icon="wifi"
            value={wifiOnlySync}
            onToggle={setWifiOnlySync}
            showArrow={false}
          />
        </Section>

        <Section title="Data">
          <SettingItem
            title="Export Data"
            subtitle="Export your recordings and settings"
            icon="cloud-download"
            onPress={handleExport}
          />
        </Section>

        <Section title="Support">
          <SettingItem
            title="Help & Support"
            subtitle="Get help with the app"
            icon="help-circle"
            onPress={handleSupport}
          />
          <SettingItem
            title="About"
            subtitle="Version and app information"
            icon="information-circle"
            onPress={handleAbout}
          />
        </Section>

        <Text style={styles.version}>
          RecorderGear v1.0.0 - Phase P0{'\n'}
          Built with React Native & Expo
        </Text>
      </ScrollView>
    </View>
  );
}
