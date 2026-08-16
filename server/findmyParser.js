import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import bplistParser from 'bplist-parser';
import { config } from './config.js';
import { sampleItems, sampleDevices } from './sampleData.js';

const execPromise = util.promisify(exec);

// Convert various timestamp formats (Cocoa epoch vs Unix epoch vs ISO) to standard Unix ms
export function normalizeTimestamp(rawTimestamp) {
  if (!rawTimestamp) return Date.now();
  
  if (typeof rawTimestamp === 'string') {
    const parsed = Date.parse(rawTimestamp);
    if (!isNaN(parsed)) return parsed;
    rawTimestamp = Number(rawTimestamp);
  }

  if (typeof rawTimestamp !== 'number' || isNaN(rawTimestamp)) {
    return Date.now();
  }

  // Already standard unix timestamp in milliseconds (e.g. 1700000000000)
  if (rawTimestamp > 1000000000000) {
    return rawTimestamp;
  }

  // Unix timestamp in seconds (e.g. 1700000000)
  if (rawTimestamp > 1000000000) {
    return rawTimestamp * 1000;
  }

  // Apple Cocoa CoreData / CFAbsoluteTime timestamp (seconds since Jan 1, 2001)
  // Example: 745000000 -> 745000000 + 978307200 = 1723307200 unix seconds
  if (rawTimestamp > 100000000 && rawTimestamp < 1000000000) {
    return (rawTimestamp + 978307200) * 1000;
  }

  return rawTimestamp;
}

// Normalize battery info across AirTags and Apple Devices
export function normalizeBattery(rawStatus, rawLevel, rawIsCharging) {
  let status = 'unknown';
  let level = 1.0;
  let percent = 100;
  let isCharging = Boolean(rawIsCharging);

  if (typeof rawLevel === 'number' && !isNaN(rawLevel)) {
    // rawLevel could be 0.0-1.0 or 0-100
    level = rawLevel > 1 ? rawLevel / 100 : rawLevel;
    percent = Math.round(level * 100);
  }

  if (typeof rawStatus === 'string') {
    const s = rawStatus.toLowerCase();
    if (s.includes('full') || s.includes('charged')) {
      status = 'full';
      if (!rawLevel) percent = 100;
    } else if (s.includes('med')) {
      status = 'medium';
      if (!rawLevel) percent = 60;
    } else if (s.includes('crit')) {
      status = 'critically_low';
      if (!rawLevel) percent = 10;
    } else if (s.includes('low')) {
      status = 'low';
      if (!rawLevel) percent = 20;
    } else if (s.includes('charg')) {
      status = 'charging';
      isCharging = true;
    } else {
      status = s;
    }
  } else if (rawStatus === 0) {
    status = 'critically_low';
    percent = 10;
  } else if (rawStatus === 1) {
    status = 'low';
    percent = 25;
  } else if (rawStatus === 2) {
    status = 'medium';
    percent = 60;
  } else if (rawStatus === 3) {
    status = 'full';
    percent = 100;
  }

  return {
    status,
    level: percent / 100,
    percent,
    isCharging
  };
}

// Assign category and emoji
export function getCategoryAndEmoji(name = '', roleName = '', roleEmoji = '', model = '', type = 'item') {
  if (roleEmoji) {
    return { category: roleName.toLowerCase() || 'item', emoji: roleEmoji };
  }

  const str = `${name} ${roleName} ${model}`.toLowerCase();

  if (type === 'device') {
    if (str.includes('macbook') || str.includes('imac') || str.includes('mac') || str.includes('laptop')) {
      return { category: 'macbook', emoji: '💻' };
    }
    if (str.includes('iphone') || str.includes('phone')) {
      return { category: 'iphone', emoji: '📱' };
    }
    if (str.includes('watch')) {
      return { category: 'applewatch', emoji: '⌚' };
    }
    if (str.includes('airpods') || str.includes('headphone') || str.includes('beats')) {
      return { category: 'airpods', emoji: '🎧' };
    }
    if (str.includes('ipad') || str.includes('tablet')) {
      return { category: 'ipad', emoji: '📱' };
    }
    return { category: 'device', emoji: '💻' };
  }

  // Items / AirTags
  if (str.includes('key')) return { category: 'keys', emoji: '🔑' };
  if (str.includes('wallet') || str.includes('purse')) return { category: 'wallet', emoji: '👛' };
  if (str.includes('backpack') || str.includes('bag') || str.includes('pack')) return { category: 'backpack', emoji: '🎒' };
  if (str.includes('bike') || str.includes('bicycle')) return { category: 'bicycle', emoji: '🚲' };
  if (str.includes('luggage') || str.includes('suitcase')) return { category: 'luggage', emoji: '🧳' };
  if (str.includes('dog') || str.includes('cat') || str.includes('pet')) return { category: 'pet', emoji: '🐾' };
  if (str.includes('car') || str.includes('auto') || str.includes('vehicle')) return { category: 'vehicle', emoji: '🚗' };
  if (str.includes('jacket') || str.includes('coat')) return { category: 'clothing', emoji: '🧥' };
  if (str.includes('camera')) return { category: 'camera', emoji: '📷' };
  if (str.includes('passport')) return { category: 'passport', emoji: '🛂' };

  return { category: 'airtag', emoji: '🏷️' };
}

// Format address
export function formatAddress(rawAddress) {
  if (!rawAddress) {
    return {
      street: '',
      city: '',
      state: '',
      country: '',
      formatted: 'Location unavailable'
    };
  }

  if (typeof rawAddress === 'string') {
    return { street: '', city: '', state: '', country: '', formatted: rawAddress };
  }

  if (Array.isArray(rawAddress.formattedAddressLines) && rawAddress.formattedAddressLines.length > 0) {
    return {
      street: rawAddress.streetAddress || rawAddress.streetName || '',
      city: rawAddress.locality || rawAddress.subAdministrativeArea || '',
      state: rawAddress.administrativeArea || '',
      country: rawAddress.country || '',
      formatted: rawAddress.formattedAddressLines.join(', ')
    };
  }

  const parts = [
    rawAddress.streetAddress || rawAddress.streetName,
    rawAddress.locality || rawAddress.subAdministrativeArea,
    rawAddress.administrativeArea,
    rawAddress.country
  ].filter(Boolean);

  return {
    street: rawAddress.streetAddress || rawAddress.streetName || '',
    city: rawAddress.locality || rawAddress.subAdministrativeArea || '',
    state: rawAddress.administrativeArea || '',
    country: rawAddress.country || '',
    formatted: parts.join(', ') || 'Address lookup in progress'
  };
}

// Parse binary plist or JSON from file buffer or path
export async function parseFileContent(filePath) {
  const buffer = await fs.readFile(filePath);
  
  // 1. Binary property list (starts with magic bytes "bplist")
  if (buffer.length >= 6 && buffer.toString('utf8', 0, 6) === 'bplist') {
    try {
      const parsed = bplistParser.parseBuffer(buffer);
      if (Array.isArray(parsed) && parsed.length === 1) {
        return parsed[0];
      }
      return parsed;
    } catch (bplistErr) {
      if (config.isMacOS) {
        try {
          const { stdout } = await execPromise(`plutil -convert json -o - "${filePath}"`);
          return JSON.parse(stdout);
        } catch (plutilErr) {
          throw new Error(`Failed to parse bplist via plutil: ${plutilErr.message}`);
        }
      }
      throw bplistErr;
    }
  }

  // 2. Standard JSON string
  const text = buffer.toString('utf8').trim();
  if (text.startsWith('{') || text.startsWith('[')) {
    return JSON.parse(text);
  }

  // 3. Fallback for macOS plutil (handles XML plists, old plist formats)
  if (config.isMacOS) {
    try {
      const { stdout } = await execPromise(`plutil -convert json -o - "${filePath}"`);
      return JSON.parse(stdout);
    } catch (e) {}
  }

  throw new Error(`Unrecognized data format in ${path.basename(filePath)} (length: ${buffer.length})`);
}

function extractArray(data, preferredKeys = ['items', 'devices', 'data', 'records', 'value']) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];

  for (const key of preferredKeys) {
    if (Array.isArray(data[key])) {
      return data[key];
    }
  }

  // If it's an object with numeric keys or values
  const values = Object.values(data);
  if (values.length > 0 && typeof values[0] === 'object') {
    return values;
  }

  return [];
}

export class FindMyParser {
  constructor(cacheDir = config.cacheDir) {
    this.cacheDir = cacheDir;
    this.itemsFilePath = path.join(cacheDir, 'Items.data');
    this.devicesFilePath = path.join(cacheDir, 'Devices.data');
  }

  async checkCacheAccess() {
    if (config.mockData) {
      return { accessible: true, isMock: true, path: this.cacheDir, error: null };
    }

    try {
      await fs.access(this.cacheDir);
      return { accessible: true, isMock: false, path: this.cacheDir, error: null };
    } catch (err) {
      return {
        accessible: false,
        isMock: false,
        path: this.cacheDir,
        error: err.code === 'EACCES' ? 'PERMISSION_DENIED' : 'NOT_FOUND',
        message: err.message
      };
    }
  }

  async readItems() {
    if (config.mockData) {
      return sampleItems;
    }

    try {
      const rawData = await parseFileContent(this.itemsFilePath);
      const itemsList = extractArray(rawData, ['items', 'data', 'records']);
      return this.parseItemsData(itemsList);
    } catch (err) {
      // If macOS cache not yet found or in development mode, fallback safely
      if (process.env.NODE_ENV !== 'production' || !config.isMacOS) {
        console.warn(`[FindMyParser] Could not read ${this.itemsFilePath} (${err.message}). Using sample items.`);
        return sampleItems;
      }
      console.error(`[FindMyParser] Failed to read items cache:`, err.message);
      return [];
    }
  }

  async readDevices() {
    if (config.mockData) {
      return sampleDevices;
    }

    try {
      const rawData = await parseFileContent(this.devicesFilePath);
      const devicesList = extractArray(rawData, ['devices', 'data', 'records']);
      return this.parseDevicesData(devicesList);
    } catch (err) {
      // Fallback for dev / mock
      if (process.env.NODE_ENV !== 'production' || !config.isMacOS) {
        console.warn(`[FindMyParser] Could not read ${this.devicesFilePath} (${err.message}). Using sample devices.`);
        return sampleDevices;
      }
      console.error(`[FindMyParser] Failed to read devices cache:`, err.message);
      return [];
    }
  }

  parseItemsData(rawItems) {
    if (!Array.isArray(rawItems)) return [];

    return rawItems.map((raw, idx) => {
      const id = raw.identifier || raw.id || raw.serialNumber || `item-${idx}`;
      const name = raw.name || raw.role?.name || `AirTag #${idx + 1}`;
      const roleName = raw.role?.name || '';
      const roleEmoji = raw.role?.emoji || '';
      const productType = raw.productType?.type || raw.productType || 'AirTag';
      const { category, emoji } = getCategoryAndEmoji(name, roleName, roleEmoji, productType, 'item');
      
      const loc = raw.location || {};
      const timestamp = normalizeTimestamp(loc.timeStamp || raw.timestamp || raw.locationTimestamp);
      const isOld = Boolean(loc.isOld || (Date.now() - timestamp > 24 * 60 * 60 * 1000));
      const battery = normalizeBattery(raw.batteryStatus, raw.batteryLevel, raw.isCharging);
      const address = formatAddress(raw.address || loc.address);

      return {
        id,
        name,
        type: 'item',
        category,
        productType: typeof productType === 'string' ? productType : 'AirTag',
        emoji,
        battery,
        location: {
          latitude: loc.latitude || 0,
          longitude: loc.longitude || 0,
          accuracy: loc.horizontalAccuracy || 15,
          timestamp,
          isOld,
          isAccurate: !loc.isInaccurate,
          positionType: loc.positionType || 'crowdsourced_ble'
        },
        address,
        isLost: Boolean(raw.lostModeMetadata?.isEnabled || raw.isLost),
        rawStatus: raw.status || 'connected'
      };
    }).filter(item => item.location.latitude !== 0 || item.location.longitude !== 0);
  }

  parseDevicesData(rawDevices) {
    if (!Array.isArray(rawDevices)) return [];

    return rawDevices.map((raw, idx) => {
      const id = raw.id || raw.deviceDiscoveryId || `device-${idx}`;
      const name = raw.name || raw.deviceDisplayName || `Apple Device #${idx + 1}`;
      const deviceModel = raw.deviceModel || raw.modelDisplayName || '';
      const productType = raw.deviceClass || raw.deviceModel || 'AppleDevice';
      const { category, emoji } = getCategoryAndEmoji(name, raw.deviceDisplayName, '', deviceModel, 'device');

      const loc = raw.location || {};
      const timestamp = normalizeTimestamp(loc.timeStamp || raw.locationTimestamp || raw.timeStamp);
      const isOld = Boolean(loc.isOld || (Date.now() - timestamp > 24 * 60 * 60 * 1000));
      const battery = normalizeBattery(raw.batteryStatus, raw.batteryLevel, raw.batteryStatus === 'Charging');
      const address = formatAddress(raw.address || loc.address);

      return {
        id,
        name,
        type: 'device',
        category,
        productType,
        modelName: raw.modelDisplayName || raw.deviceDisplayName || deviceModel || 'Apple Device',
        emoji,
        battery,
        location: {
          latitude: loc.latitude || 0,
          longitude: loc.longitude || 0,
          accuracy: loc.horizontalAccuracy || 10,
          timestamp,
          isOld,
          isAccurate: !loc.isInaccurate,
          positionType: loc.positionType || 'wifi'
        },
        address,
        isLocating: Boolean(raw.isLocating),
        isLost: Boolean(raw.lostModeEnabled || raw.isLost),
        rawStatus: raw.deviceStatus || 'online'
      };
    }).filter(dev => dev.location.latitude !== 0 || dev.location.longitude !== 0);
  }

  async getAll() {
    const [items, devices] = await Promise.all([
      this.readItems(),
      this.readDevices()
    ]);

    return {
      updatedAt: new Date().toISOString(),
      timestamp: Date.now(),
      totalCount: items.length + devices.length,
      itemsCount: items.length,
      devicesCount: devices.length,
      items,
      devices,
      all: [...items, ...devices].sort((a, b) => b.location.timestamp - a.location.timestamp)
    };
  }
}
