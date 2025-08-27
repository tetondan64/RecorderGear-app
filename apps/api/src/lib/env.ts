import { config } from 'dotenv';
import type { Environment } from '../types';

// Load environment variables from .env file
config();

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

function getEnvNumber(name: string, defaultValue?: number): number {
  const value = process.env[name];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Required environment variable ${name} is not set`);
  }
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`Environment variable ${name} must be a valid number`);
  }
  return num;
}

function getEnvBoolean(name: string, defaultValue?: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value.toLowerCase() === 'true';
}

export const env: Environment = {
  PORT: getEnvNumber('PORT', 4000),
  S3_ENDPOINT: getEnvVar('S3_ENDPOINT'),
  S3_REGION: getEnvVar('S3_REGION', 'us-east-1'),
  S3_ACCESS_KEY: getEnvVar('S3_ACCESS_KEY'),
  S3_SECRET_KEY: getEnvVar('S3_SECRET_KEY'),
  S3_BUCKET: getEnvVar('S3_BUCKET'),
  S3_FORCE_PATH_STYLE: getEnvBoolean('S3_FORCE_PATH_STYLE', true),
  PRESIGN_EXPIRES_SEC: getEnvNumber('PRESIGN_EXPIRES_SEC', 900),
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),
};

export function validateEnvironment(): void {
  console.log('🔧 Environment configuration:');
  console.log(`  PORT: ${env.PORT}`);
  console.log(`  S3_ENDPOINT: ${env.S3_ENDPOINT}`);
  console.log(`  S3_REGION: ${env.S3_REGION}`);
  console.log(`  S3_BUCKET: ${env.S3_BUCKET}`);
  console.log(`  S3_FORCE_PATH_STYLE: ${env.S3_FORCE_PATH_STYLE}`);
  console.log(`  PRESIGN_EXPIRES_SEC: ${env.PRESIGN_EXPIRES_SEC}`);
  console.log(`  NODE_ENV: ${env.NODE_ENV}`);
}