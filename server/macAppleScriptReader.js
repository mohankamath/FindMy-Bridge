import { exec } from 'child_process';
import util from 'util';
import { getCategoryAndEmoji, normalizeBattery } from './findmyParser.js';

const execPromise = util.promisify(exec);

// Geocode address text using OpenStreetMap Nominatim cache
const geocodeCache = new Map();

async function geocodeAddress(addressStr) {
  if (!addressStr || addressStr === 'Location unavailable' || addressStr.includes('Loading')) {
    return { lat: 0, lon: 0 };
  }

  if (geocodeCache.has(addressStr)) {
    return geocodeCache.get(addressStr);
  }

  try {
    const clean = encodeURIComponent(addressStr.trim());
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${clean}&format=json&limit=1`, {
      headers: { 'User-Agent': 'FindMyBridge/1.0' }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const coords = {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon)
        };
        geocodeCache.set(addressStr, coords);
        return coords;
      }
    }
  } catch (e) {}

  return { lat: 0, lon: 0 };
}

export class MacAppleScriptReader {
  async getFindMyData() {
    // AppleScript that queries the running Find My app's UI elements safely
    const script = `
      set output to ""
      tell application "Find My" to activate
      delay 0.3
      tell application "System Events"
        tell process "Find My"
          set visible to false
          set allUI to entire contents of front window
          set textList to {}
          repeat with anItem in allUI
            try
              set itemClass to class of anItem as string
              if itemClass contains "static text" or itemClass contains "row" or itemClass contains "button" then
                set itemVal to value of anItem
                if itemVal is not missing value and itemVal is not "" then
                  set end of textList to (itemVal as string)
                else
                  set itemDesc to description of anItem
                  if itemDesc is not missing value and itemDesc is not "" then
                    set end of textList to (itemDesc as string)
                  end if
                end if
              end if
            end try
          end repeat
        end tell
      end tell
      set AppleScript's text item delimiters to "|||"
      return textList as string
    `;

    try {
      const { stdout } = await execPromise(`osascript -e '${script.replace(/\n/g, ' ')}'`);
      const rawEntries = stdout.split('|||').map(s => s.trim()).filter(Boolean);
      return this.parseTextList(rawEntries);
    } catch (err) {
      console.warn(`[AppleScriptReader] Notice:`, err.message);
      return null;
    }
  }

  async parseTextList(rawEntries) {
    if (!rawEntries || rawEntries.length === 0) return null;

    // Filter out generic app UI labels
    const ignoreList = new Set(['Find My', 'Items', 'Devices', 'People', 'Me', 'Map', 'Search', '+', 'zoom in', 'zoom out']);
    const meaningful = rawEntries.filter(text => !ignoreList.has(text) && text.length > 1);

    // Group items by pattern (Name, Address, Time/Distance)
    const records = [];
    let current = {};

    for (let i = 0; i < meaningful.length; i++) {
      const text = meaningful[i];

      // Time patterns: "Now", "5m ago", "1 hr ago", "Yesterday"
      const isTime = /\b(\d+[mhd] ago|Now|Just now|Yesterday|\d+:\d+ [AP]M)\b/i.test(text);
      // Battery patterns: "Battery 85%", "100%", "Charging"
      const isBattery = /\b\d{1,3}%\b/i.test(text);

      if (!current.name && !isTime && !isBattery && text.length < 50) {
        current.name = text;
      } else if (current.name && !current.address && !isTime && !isBattery) {
        current.address = text;
      } else if (isTime || isBattery || i === meaningful.length - 1) {
        if (isTime) current.time = text;
        if (isBattery) current.battery = text;

        if (current.name) {
          records.push({ ...current });
          current = {};
        }
      }
    }

    if (records.length === 0) return null;

    // Map to standard items
    const parsedItems = [];
    for (let idx = 0; idx < records.length; idx++) {
      const rec = records[idx];
      const { category, emoji } = getCategoryAndEmoji(rec.name, '', '', '', 'item');
      const coords = await geocodeAddress(rec.address);

      parsedItems.push({
        id: `mac-ui-item-${idx}`,
        name: rec.name,
        type: 'item',
        category,
        productType: 'AirTag',
        emoji,
        battery: normalizeBattery(rec.battery || 'full', null, false),
        location: {
          latitude: coords.lat,
          longitude: coords.lon,
          accuracy: 15,
          timestamp: Date.now(),
          isOld: false,
          isAccurate: coords.lat !== 0,
          positionType: 'crowdsourced_ble'
        },
        address: {
          street: '',
          city: '',
          state: '',
          country: '',
          formatted: rec.address || 'Location reported'
        },
        isLost: false,
        rawStatus: 'active'
      });
    }

    return parsedItems;
  }
}
