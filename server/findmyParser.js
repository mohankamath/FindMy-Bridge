import fs from 'fs/promises';
import path from 'path';
import os from 'os';
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

import zlib from 'zlib';
import { MacAppleScriptReader } from './macAppleScriptReader.js';

// Parse binary plist or JSON from file buffer or path
export async function parseFileContent(filePath) {
  let parsedJson = null;

  // On macOS, native plutil handles Apple's exact bplist and CoreData formats best
  if (config.isMacOS) {
    try {
      const { stdout } = await execPromise(`plutil -convert json -o - "${filePath}"`);
      if (stdout && stdout.trim()) {
        parsedJson = JSON.parse(stdout);
      }
    } catch (plutilErr) {}
  }

  if (!parsedJson) {
    const buffer = await fs.readFile(filePath);
    
    // 1. Binary property list (starts with magic bytes "bplist")
    if (buffer.length >= 6 && buffer.toString('utf8', 0, 6) === 'bplist') {
      try {
        const parsed = bplistParser.parseBuffer(buffer);
        parsedJson = Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : parsed;
      } catch (bplistErr) {
        throw bplistErr;
      }
    } else {
      // 2. Standard JSON string
      const text = buffer.toString('utf8').trim();
      if (text.startsWith('{') || text.startsWith('[')) {
        parsedJson = JSON.parse(text);
      }
    }
  }

  if (!parsedJson) {
    throw new Error(`Unrecognized data format in ${path.basename(filePath)}`);
  }

  // Check if encryptedData payload can be decompressed
  if (parsedJson && parsedJson.encryptedData) {
    const rawBuf = Buffer.isBuffer(parsedJson.encryptedData) 
      ? parsedJson.encryptedData 
      : Buffer.from(parsedJson.encryptedData.data || parsedJson.encryptedData);

    try {
      const decompressed = zlib.inflateSync(rawBuf);
      const decText = decompressed.toString('utf8').trim();
      if (decText.startsWith('{') || decText.startsWith('[')) {
        return JSON.parse(decText);
      }
      return bplistParser.parseBuffer(decompressed);
    } catch (zlibErr) {
      try {
        const unzipped = zlib.gunzipSync(rawBuf);
        const decText = unzipped.toString('utf8').trim();
        if (decText.startsWith('{') || decText.startsWith('[')) {
          return JSON.parse(decText);
        }
        return bplistParser.parseBuffer(unzipped);
      } catch (gzipErr) {}
    }
  }

  return parsedJson;
}

function isPlainRecord(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return false;
  if (Buffer.isBuffer(obj)) return false;
  if (obj.type === 'Buffer' && Array.isArray(obj.data)) return false;
  return true;
}

function extractArray(data, preferredKeys = ['items', 'devices', 'data', 'records', 'beacons', 'itemsArray']) {
  if (!data) return [];

  // If already array of plain records
  if (Array.isArray(data)) {
    const valid = data.filter(isPlainRecord);
    if (valid.length > 0) return valid;
    // If array of buffers, return []
    return [];
  }

  if (typeof data !== 'object' || Buffer.isBuffer(data)) return [];

  // If NSKeyedArchiver structure ($objects)
  if (Array.isArray(data.$objects)) {
    const candidateObjects = data.$objects.filter(obj => 
      isPlainRecord(obj) &&
      (obj.name || obj.deviceDisplayName || obj.location || obj.latitude || obj.role || obj.productType || obj.baUUID || obj.deviceModel || obj.identifier)
    );
    if (candidateObjects.length > 0) return candidateObjects;
  }

  // 1. Check preferred nested keys
  for (const key of preferredKeys) {
    if (Array.isArray(data[key])) {
      const valid = data[key].filter(isPlainRecord);
      if (valid.length > 0) return valid;
    } else if (isPlainRecord(data[key])) {
      const nestedValues = Object.values(data[key]).filter(isPlainRecord);
      if (nestedValues.length > 0) return nestedValues;
    }
  }

  // 2. Check if any property is an array of plain records
  for (const [key, val] of Object.entries(data)) {
    if (Array.isArray(val)) {
      const valid = val.filter(isPlainRecord);
      if (valid.length > 0) return valid;
    }
  }

  // 3. If it's a dictionary mapping UUIDs to object records
  const values = Object.values(data).filter(isPlainRecord);
  if (values.length > 0) {
    return values;
  }

  return [];
}

// Deep key finders
function findVal(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

export class FindMyParser {
  constructor(cacheDir = config.cacheDir) {
    this.cacheDir = cacheDir;
    this.itemsFilePath = path.join(cacheDir, 'Items.data');
    this.devicesFilePath = path.join(cacheDir, 'Devices.data');
    this.beaconFilePath = path.join(cacheDir, 'Beacon.data');
    this.home = os.homedir();
    this.appleScriptReader = new MacAppleScriptReader();
    this.candidateDirs = [
      cacheDir,
      path.join(this.home, 'Library/Containers/com.apple.findmy/Data/Library/Caches/com.apple.findmy.fmipcore'),
      path.join(this.home, 'Library/Containers/com.apple.findmy/Data/Library/Caches'),
      path.join(this.home, 'Library/Group Containers/group.com.apple.findmy/Library/Caches'),
      path.join(this.home, 'Library/Group Containers/group.com.apple.findmy'),
      path.join(this.home, 'Library/Caches/com.apple.findmy'),
      path.join(this.home, 'Library/Containers/com.apple.findmy.findmywidgets/Data/Library/Caches'),
      path.join(this.home, 'Library/Application Support/com.apple.findmy')
    ];
  }

  async scanAllFindMyFiles() {
    const foundFiles = [];
    for (const dir of this.candidateDirs) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile()) {
            const fullPath = path.join(dir, entry.name);
            const stat = await fs.stat(fullPath);
            foundFiles.push({ name: entry.name, path: fullPath, size: stat.size });
          }
        }
      } catch (e) {}
    }
    return foundFiles;
  }

  async findFile(filename) {
    for (const dir of this.candidateDirs) {
      const full = path.join(dir, filename);
      try {
        const stat = await fs.stat(full);
        if (stat.size > 100) {
          return full;
        }
      } catch (e) {}
    }
    for (const dir of this.candidateDirs) {
      const full = path.join(dir, filename);
      try {
        await fs.access(full);
        return full;
      } catch (e) {}
    }
    return path.join(this.cacheDir, filename);
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

  async readRawFile(filePath) {
    const rawData = await parseFileContent(filePath);
    return rawData;
  }

  async readItems() {
    if (config.mockData) {
      return sampleItems;
    }

    try {
      const itemsPath = await this.findFile('Items.data');
      let rawData = null;
      let usedPath = itemsPath;

      try {
        rawData = await parseFileContent(itemsPath);
      } catch (itemsErr) {
        const beaconPath = await this.findFile('Beacon.data');
        try {
          rawData = await parseFileContent(beaconPath);
          usedPath = beaconPath;
        } catch (beaconErr) {
          throw itemsErr;
        }
      }

      const itemsList = extractArray(rawData, ['items', 'data', 'records', 'beacons']);
      console.log(`[FindMyParser] Parsed ${itemsList.length} valid item records from ${usedPath}`);
      if (itemsList.length > 0) {
        console.log(`[FindMyParser] Item sample keys:`, Object.keys(itemsList[0]));
        return this.parseItemsData(itemsList);
      }

      // If disk cache is encrypted/empty, read live from Find My app
      if (config.isMacOS) {
        console.log(`[FindMyParser] Reading live items from Find My app via AppleScript...`);
        const liveItems = await this.appleScriptReader.getFindMyData();
        if (liveItems && liveItems.length > 0) {
          return liveItems;
        }
      }

      return [];
    } catch (err) {
      console.error(`[FindMyParser] Failed to read items cache:`, err.message);
      if (config.isMacOS) {
        const liveItems = await this.appleScriptReader.getFindMyData();
        if (liveItems && liveItems.length > 0) return liveItems;
      }
      return [];
    }
  }

  async readDevices() {
    if (config.mockData) {
      return sampleDevices;
    }

    try {
      const devicesPath = await this.findFile('Devices.data');
      const rawData = await parseFileContent(devicesPath);
      const devicesList = extractArray(rawData, ['devices', 'data', 'records']);
      console.log(`[FindMyParser] Parsed ${devicesList.length} valid device records from ${devicesPath}`);
      if (devicesList.length > 0) {
        console.log(`[FindMyParser] Device sample keys:`, Object.keys(devicesList[0]));
        return this.parseDevicesData(devicesList);
      }

      return [];
    } catch (err) {
      console.error(`[FindMyParser] Failed to read devices cache:`, err.message);
      return [];
    }
  }

  parseItemsData(rawItems) {
    if (!Array.isArray(rawItems)) return [];

    return rawItems.map((raw, idx) => {
      const id = findVal(raw, 'identifier', 'id', 'serialNumber', 'beaconIdentifier', 'baUUID') || `item-${idx}`;
      
      const roleObj = raw.role && typeof raw.role === 'object' ? raw.role : {};
      const roleName = findVal(roleObj, 'name') || (typeof raw.role === 'string' ? raw.role : '');
      const roleEmoji = findVal(roleObj, 'emoji') || '';

      const name = findVal(raw, 'name', 'customName', 'title', 'ownerName', 'label', 'description') || roleName || `AirTag #${idx + 1}`;
      
      const prodTypeObj = raw.productType && typeof raw.productType === 'object' ? raw.productType : {};
      const productType = findVal(prodTypeObj, 'type') || (typeof raw.productType === 'string' ? raw.productType : '') || findVal(raw, 'partNumber', 'model') || 'AirTag';
      
      const { category, emoji } = getCategoryAndEmoji(name, roleName, roleEmoji, productType, 'item');
      
      const loc = findVal(raw, 'location', 'position', 'lastKnownLocation', 'beaconLocation', 'coordinate') || {};
      const lat = Number(findVal(loc, 'latitude', 'lat') ?? findVal(raw, 'latitude', 'lat') ?? 0);
      const lon = Number(findVal(loc, 'longitude', 'long', 'lng') ?? findVal(raw, 'longitude', 'long', 'lng') ?? 0);
      const rawTs = findVal(loc, 'timeStamp', 'timestamp', 'locationTimestamp') ?? findVal(raw, 'timestamp', 'locationTimestamp');
      const timestamp = normalizeTimestamp(rawTs);
      
      const isOld = Boolean(loc.isOld || (Date.now() - timestamp > 24 * 60 * 60 * 1000));
      const battery = normalizeBattery(
        findVal(raw, 'batteryStatus', 'batteryLevelStatus'),
        findVal(raw, 'batteryLevel', 'batteryPercent'),
        findVal(raw, 'isCharging')
      );
      
      const address = formatAddress(findVal(raw, 'address', 'lastKnownAddress') || loc.address || loc.formattedAddressLines);

      return {
        id: String(id),
        name: String(name),
        type: 'item',
        category,
        productType: typeof productType === 'string' ? productType : 'AirTag',
        emoji,
        battery,
        location: {
          latitude: lat,
          longitude: lon,
          accuracy: Number(findVal(loc, 'horizontalAccuracy', 'accuracy') ?? 15),
          timestamp,
          isOld,
          isAccurate: !loc.isInaccurate,
          positionType: loc.positionType || 'crowdsourced_ble'
        },
        address,
        isLost: Boolean(raw.lostModeMetadata?.isEnabled || raw.isLost),
        rawStatus: raw.status || 'connected'
      };
    });
  }

  parseDevicesData(rawDevices) {
    if (!Array.isArray(rawDevices)) return [];

    return rawDevices.map((raw, idx) => {
      const id = findVal(raw, 'id', 'deviceDiscoveryId', 'serialNumber', 'baUUID', 'prsId') || `device-${idx}`;
      const name = findVal(raw, 'name', 'deviceDisplayName', 'modelDisplayName', 'deviceName', 'title') || `Apple Device #${idx + 1}`;
      const deviceModel = findVal(raw, 'deviceModel', 'modelDisplayName', 'rawDeviceModel', 'model') || '';
      const productType = findVal(raw, 'deviceClass', 'deviceModel', 'deviceType') || 'AppleDevice';
      const { category, emoji } = getCategoryAndEmoji(name, raw.deviceDisplayName, '', deviceModel, 'device');

      const loc = findVal(raw, 'location', 'position', 'lastKnownLocation', 'deviceLocation', 'coordinate') || {};
      const lat = Number(findVal(loc, 'latitude', 'lat') ?? findVal(raw, 'latitude', 'lat') ?? 0);
      const lon = Number(findVal(loc, 'longitude', 'long', 'lng') ?? findVal(raw, 'longitude', 'long', 'lng') ?? 0);
      const rawTs = findVal(loc, 'timeStamp', 'timestamp', 'locationTimestamp') ?? findVal(raw, 'locationTimestamp', 'timeStamp', 'timestamp');
      const timestamp = normalizeTimestamp(rawTs);
      
      const isOld = Boolean(loc.isOld || (Date.now() - timestamp > 24 * 60 * 60 * 1000));
      const battery = normalizeBattery(
        findVal(raw, 'batteryStatus', 'batteryLevelStatus'),
        findVal(raw, 'batteryLevel', 'batteryPercent'),
        raw.batteryStatus === 'Charging' || raw.isCharging
      );
      
      const address = formatAddress(findVal(raw, 'address', 'lastKnownAddress') || loc.address || loc.formattedAddressLines);

      return {
        id: String(id),
        name: String(name),
        type: 'device',
        category,
        productType: typeof productType === 'string' ? productType : 'AppleDevice',
        modelName: raw.modelDisplayName || raw.deviceDisplayName || deviceModel || 'Apple Device',
        emoji,
        battery,
        location: {
          latitude: lat,
          longitude: lon,
          accuracy: Number(findVal(loc, 'horizontalAccuracy', 'accuracy') ?? 10),
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
    });
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
