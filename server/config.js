import path from 'path';
import os from 'os';
import dotenv from 'dotenv';

dotenv.config();

function expandHome(filepath) {
  if (!filepath) return filepath;
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

const defaultCacheDir = path.join(
  os.homedir(),
  'Library',
  'Caches',
  'com.apple.findmy.fmipcore'
);

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  authToken: process.env.AUTH_TOKEN ? process.env.AUTH_TOKEN.trim() : '',
  cacheDir: expandHome(process.env.FINDMY_CACHE_DIR) || defaultCacheDir,
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '5000', 10),
  enableMacRefresh: process.env.ENABLE_MAC_REFRESH !== 'false',
  refreshIntervalMinutes: parseInt(process.env.REFRESH_INTERVAL_MINUTES || '5', 10),
  mockData: process.env.MOCK_DATA === 'true' || process.env.NODE_ENV === 'test',
  isMacOS: process.platform === 'darwin',
};
