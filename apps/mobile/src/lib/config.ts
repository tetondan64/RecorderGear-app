import { SettingsStore } from './fs/settingsStore';

/**
 * Cloud configuration management
 * Stores API base URL and connection settings
 */

export interface CloudConfig {
  baseUrl: string;
  connected: boolean;
  lastChecked?: string;
}

const DEFAULT_CONFIG: CloudConfig = {
  baseUrl: '',
  connected: false,
};

let cachedConfig: CloudConfig | null = null;

/**
 * Get current cloud configuration
 */
export async function getCloudConfig(): Promise<CloudConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    // Read from existing settings store, extend it for cloud config
    const settings = await SettingsStore.readSettings();
    const cloudConfig: CloudConfig = {
      baseUrl: (settings as any).cloudBaseUrl || '',
      connected: (settings as any).cloudConnected || false,
      lastChecked: (settings as any).cloudLastChecked,
    };
    
    cachedConfig = cloudConfig;
    return cloudConfig;
  } catch {
    cachedConfig = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }
}

/**
 * Update cloud configuration
 */
export async function setCloudConfig(config: Partial<CloudConfig>): Promise<void> {
  const currentConfig = await getCloudConfig();
  const newConfig = { ...currentConfig, ...config };
  
  try {
    // Read existing settings and merge
    const settings = await SettingsStore.readSettings();
    const updatedSettings = {
      ...settings,
      cloudBaseUrl: newConfig.baseUrl,
      cloudConnected: newConfig.connected,
      cloudLastChecked: newConfig.lastChecked,
    };
    
    await SettingsStore.writeSettings(updatedSettings);
    cachedConfig = newConfig;
    
    console.log('CLOUD_CONFIG: Updated:', newConfig);
  } catch (error) {
    console.error('CLOUD_CONFIG: Failed to save:', error);
    throw error;
  }
}

/**
 * Test connection to API server
 */
export async function testCloudConnection(baseUrl: string): Promise<boolean> {
  try {
    const cleanUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    const response = await fetch(`${cleanUrl}/v1/health/ping`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Danger-Dev-Server': 'true',
      },
      timeout: 5000,
    } as any);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.ok === true && data.storage === 's3';
  } catch (error) {
    console.warn('CLOUD_CONFIG: Connection test failed:', error);
    return false;
  }
}

/**
 * Get API base URL with validation
 */
export async function getApiBaseUrl(): Promise<string> {
  const config = await getCloudConfig();
  if (!config.baseUrl) {
    throw new Error('Cloud API URL not configured. Please set it in Settings.');
  }
  return config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
}

/**
 * Check if cloud is configured and connected
 */
export async function isCloudAvailable(): Promise<boolean> {
  try {
    const config = await getCloudConfig();
    return !!(config.baseUrl && config.connected);
  } catch {
    return false;
  }
}