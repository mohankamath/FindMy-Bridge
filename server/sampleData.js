export const sampleItems = [
  {
    id: "item-airtag-keys-001",
    name: "Keys",
    type: "item",
    category: "keys",
    productType: "AirTag",
    emoji: "🔑",
    battery: {
      status: "full",
      level: 0.95,
      percent: 95,
      isCharging: false
    },
    location: {
      latitude: 40.758896,
      longitude: -73.985130,
      accuracy: 10,
      timestamp: Date.now() - 3 * 60 * 1000,
      isOld: false,
      isAccurate: true,
      positionType: "crowdsourced_ble"
    },
    address: {
      street: "1540 Broadway",
      city: "New York",
      state: "NY",
      country: "United States",
      formatted: "1540 Broadway, New York, NY 10036"
    },
    isLost: false,
    rawStatus: "connected"
  },
  {
    id: "item-airtag-backpack-002",
    name: "Work Backpack",
    type: "item",
    category: "backpack",
    productType: "AirTag",
    emoji: "🎒",
    battery: {
      status: "medium",
      level: 0.65,
      percent: 65,
      isCharging: false
    },
    location: {
      latitude: 40.748441,
      longitude: -73.985664,
      accuracy: 15,
      timestamp: Date.now() - 12 * 60 * 1000,
      isOld: false,
      isAccurate: true,
      positionType: "crowdsourced_ble"
    },
    address: {
      street: "350 5th Ave",
      city: "New York",
      state: "NY",
      country: "United States",
      formatted: "350 5th Ave, Empire State Building, New York, NY 10118"
    },
    isLost: false,
    rawStatus: "connected"
  },
  {
    id: "item-airtag-wallet-003",
    name: "MagSafe Wallet",
    type: "item",
    category: "wallet",
    productType: "ThirdPartyItem",
    emoji: "👛",
    battery: {
      status: "low",
      level: 0.20,
      percent: 20,
      isCharging: false
    },
    location: {
      latitude: 40.7614,
      longitude: -73.9776,
      accuracy: 25,
      timestamp: Date.now() - 45 * 60 * 1000,
      isOld: false,
      isAccurate: true,
      positionType: "crowdsourced_ble"
    },
    address: {
      street: "11 W 53rd St",
      city: "New York",
      state: "NY",
      country: "United States",
      formatted: "11 W 53rd St, New York, NY 10019"
    },
    isLost: false,
    rawStatus: "connected"
  },
  {
    id: "item-airtag-bike-004",
    name: "Road Bike",
    type: "item",
    category: "bicycle",
    productType: "AirTag",
    emoji: "🚲",
    battery: {
      status: "full",
      level: 0.90,
      percent: 90,
      isCharging: false
    },
    location: {
      latitude: 40.7829,
      longitude: -73.9654,
      accuracy: 8,
      timestamp: Date.now() - 8 * 60 * 1000,
      isOld: false,
      isAccurate: true,
      positionType: "crowdsourced_ble"
    },
    address: {
      street: "Central Park West",
      city: "New York",
      state: "NY",
      country: "United States",
      formatted: "Central Park West, New York, NY 10024"
    },
    isLost: false,
    rawStatus: "connected"
  }
];

export const sampleDevices = [
  {
    id: "dev-macbook-pro-001",
    name: "Mohan's MacBook Pro",
    type: "device",
    category: "macbook",
    productType: "MacBookPro18,1",
    modelName: "MacBook Pro 16\"",
    emoji: "💻",
    battery: {
      status: "charging",
      level: 0.88,
      percent: 88,
      isCharging: true
    },
    location: {
      latitude: 40.758896,
      longitude: -73.985130,
      accuracy: 5,
      timestamp: Date.now() - 1 * 60 * 1000,
      isOld: false,
      isAccurate: true,
      positionType: "wifi"
    },
    address: {
      street: "1540 Broadway",
      city: "New York",
      state: "NY",
      country: "United States",
      formatted: "1540 Broadway, New York, NY 10036"
    },
    isLocating: false,
    isLost: false,
    rawStatus: "online"
  },
  {
    id: "dev-iphone-15-002",
    name: "iPhone 15 Pro",
    type: "device",
    category: "iphone",
    productType: "iPhone15,2",
    modelName: "iPhone 15 Pro",
    emoji: "📱",
    battery: {
      status: "charged",
      level: 0.74,
      percent: 74,
      isCharging: false
    },
    location: {
      latitude: 40.7592,
      longitude: -73.9845,
      accuracy: 6,
      timestamp: Date.now() - 2 * 60 * 1000,
      isOld: false,
      isAccurate: true,
      positionType: "gps"
    },
    address: {
      street: "1560 Broadway",
      city: "New York",
      state: "NY",
      country: "United States",
      formatted: "1560 Broadway, New York, NY 10036"
    },
    isLocating: false,
    isLost: false,
    rawStatus: "online"
  },
  {
    id: "dev-airpods-pro-003",
    name: "AirPods Pro (2nd Gen)",
    type: "device",
    category: "airpods",
    productType: "AirPodsPro2",
    modelName: "AirPods Pro",
    emoji: "🎧",
    battery: {
      status: "in_case",
      level: 0.98,
      percent: 98,
      isCharging: true
    },
    location: {
      latitude: 40.758896,
      longitude: -73.985130,
      accuracy: 12,
      timestamp: Date.now() - 5 * 60 * 1000,
      isOld: false,
      isAccurate: true,
      positionType: "crowdsourced_ble"
    },
    address: {
      street: "1540 Broadway",
      city: "New York",
      state: "NY",
      country: "United States",
      formatted: "1540 Broadway, New York, NY 10036"
    },
    isLocating: false,
    isLost: false,
    rawStatus: "connected"
  },
  {
    id: "dev-apple-watch-004",
    name: "Apple Watch Ultra",
    type: "device",
    category: "applewatch",
    productType: "Watch6,18",
    modelName: "Apple Watch Ultra 2",
    emoji: "⌚",
    battery: {
      status: "internal_battery",
      level: 0.62,
      percent: 62,
      isCharging: false
    },
    location: {
      latitude: 40.7590,
      longitude: -73.9848,
      accuracy: 7,
      timestamp: Date.now() - 4 * 60 * 1000,
      isOld: false,
      isAccurate: true,
      positionType: "gps"
    },
    address: {
      street: "Times Square",
      city: "New York",
      state: "NY",
      country: "United States",
      formatted: "Times Square, New York, NY 10036"
    },
    isLocating: false,
    isLost: false,
    rawStatus: "online"
  },
  {
    id: "dev-ipad-pro-005",
    name: "iPad Pro 11\"",
    type: "device",
    category: "ipad",
    productType: "iPad13,4",
    modelName: "iPad Pro 11-inch (M2)",
    emoji: "📱",
    battery: {
      status: "internal_battery",
      level: 0.45,
      percent: 45,
      isCharging: false
    },
    location: {
      latitude: 40.7488,
      longitude: -73.9850,
      accuracy: 10,
      timestamp: Date.now() - 25 * 60 * 1000,
      isOld: false,
      isAccurate: true,
      positionType: "wifi"
    },
    address: {
      street: "34th St & 5th Ave",
      city: "New York",
      state: "NY",
      country: "United States",
      formatted: "34th St & 5th Ave, New York, NY 10016"
    },
    isLocating: false,
    isLost: false,
    rawStatus: "online"
  }
];
