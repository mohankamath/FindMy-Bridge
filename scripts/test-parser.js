import { FindMyParser, normalizeTimestamp, normalizeBattery, getCategoryAndEmoji, formatAddress } from '../server/findmyParser.js';

console.log('--- Running FindMy Bridge Tests ---');

// 1. Test Timestamp normalization
const testNow = Date.now();
const cocoaSec = 745000000; // ~2024
const convertedCocoa = normalizeTimestamp(cocoaSec);
console.assert(convertedCocoa > 1700000000000, 'Cocoa timestamp should convert to Unix ms');
console.log('✓ Timestamp normalization passed');

// 2. Test Battery normalization
const fullBat = normalizeBattery('full', null, false);
console.assert(fullBat.percent === 100 && fullBat.status === 'full', 'Full battery normalization failed');

const chargingBat = normalizeBattery('charging', 0.85, true);
console.assert(chargingBat.percent === 85 && chargingBat.isCharging === true, 'Charging battery normalization failed');
console.log('✓ Battery normalization passed');

// 3. Test Emoji mapping
const keyEmoji = getCategoryAndEmoji('Keys', '', '', '', 'item');
console.assert(keyEmoji.emoji === '🔑', 'Keys emoji mapping failed');

const macEmoji = getCategoryAndEmoji('MacBook Pro', '', '', 'MacBookPro18,1', 'device');
console.assert(macEmoji.emoji === '💻', 'MacBook emoji mapping failed');
console.log('✓ Emoji & Category mapping passed');

// 4. Test Parser on sample data
const parser = new FindMyParser();
const all = await parser.getAll();
console.assert(all.itemsCount > 0, 'Items count should be > 0');
console.assert(all.devicesCount > 0, 'Devices count should be > 0');
console.log(`✓ Parser successfully extracted ${all.itemsCount} items and ${all.devicesCount} devices`);

console.log('🎉 All FindMy Bridge tests passed successfully!');
