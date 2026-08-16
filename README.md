# 🧭 FindMy Android Bridge

Access Apple's **Find My** network, AirTags, and Apple Devices directly from your **Android phone** using a lightweight macOS companion bridge and a mobile-optimized Progressive Web App (PWA).

---

## 🌟 Key Features

- 📍 **Real-time Map**: Live tracking of AirTags, MagSafe Wallets, Backpacks, Keys, Bikes, iPhones, MacBooks, Apple Watches, and AirPods.
- 📱 **Native Android Experience**: Installable PWA with one-touch launch from your Android home screen.
- 🧭 **Google Maps Directions**: One-tap direct deep link into Google Maps navigation from any AirTag / item.
- 📏 **Proximity Distance**: Calculates live distance from your Android phone to each item (e.g. *"85 m away"*, *"1.2 km away"*).
- 🔋 **Battery & Status**: Live battery status percentage indicators, charging status, and accuracy radius.
- 🌐 **Tailscale Funnel Ready**: Securely accessible anywhere in the world without opening router ports or port-forwarding.
- 🔄 **macOS Background Service**: Runs silently via `launchd` and automatically starts on Mac boot.

---

## 🚀 Quick Start on your MacBook

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure (Optional Auth Token)
Copy the environment template:
```bash
cp .env.example .env
```
*(Optional)* Edit `.env` to set an `AUTH_TOKEN` (PIN or secret passphrase) if you'd like to protect your instance over public Tailscale Funnel URLs.

### 3. Grant Full Disk Access on macOS
Apple protects `~/Library/Caches/com.apple.findmy.fmipcore/` under macOS Privacy controls.
1. Open **System Settings** > **Privacy & Security** > **Full Disk Access**.
2. Click the `+` icon and add **Terminal** (or **iTerm2** / **Node**).
3. Ensure the toggle is turned **ON**.
4. Open the native **Find My** app on your Mac once so macOS caches your latest items.

### 4. Start the Bridge
```bash
npm start
```
Or run the automated setup wizard:
```bash
npm run setup:mac
```

---

## 🌐 Connecting from Android via Tailscale Funnel

Since you already have **Tailscale Funnel** enabled on your MacBook:

1. In your MacBook terminal, start Tailscale Funnel on port `3000`:
   ```bash
   tailscale funnel 3000
   ```
2. Tailscale will provide your public HTTPS URL (e.g. `https://your-macbook.tailscale.net`).
3. Open this URL on your Android phone's browser (Chrome, Firefox, or Brave).
4. *(Optional)* If you configured `AUTH_TOKEN`, tap the ⚙️ Settings icon in the top right to enter and save your token once.

---

## 📲 Install as an App on Android (PWA)

1. Open your FindMy bridge URL in **Google Chrome** on Android.
2. Tap the Chrome menu (**⋮** three dots in top right).
3. Tap **"Install app"** or **"Add to Home screen"**.
4. The FindMy radar icon will appear on your Android home screen and open in full-screen standalone mode.

---

## ⚙️ REST API & WebSocket Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/status` | `GET` | Health check, cache status, item counts, uptime |
| `/api/all` | `GET` | All combined items and devices with full coordinates |
| `/api/items` | `GET` | AirTags and 3rd-party Find My items |
| `/api/devices` | `GET` | Apple devices (iPhones, Macs, Watches, AirPods) |
| `/api/refresh` | `POST` | Triggers macOS Find My background sync |
| `/ws` | `WebSocket` | Real-time push stream for live location changes |

---

## 🛠️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                   MacBook (macOS)                      │
│                                                        │
│  [Apple Find My App]                                   │
│         │ (writes cache)                               │
│         ▼                                              │
│  ~/Library/Caches/com.apple.findmy.fmipcore/           │
│    ├── Items.data   (AirTags, Keys, Wallets, etc.)     │
│    └── Devices.data (iPhones, Macs, Watches, AirPods)  │
│         │                                              │
│         ▼ (reads & parses)                             │
│  [FindMy Bridge Service (Node.js + Express + WS)]      │
└───────────────────────┬────────────────────────────────┘
                        │ Tailscale Funnel (HTTPS)
                        ▼
┌────────────────────────────────────────────────────────┐
│                 Android Smartphone                     │
│                                                        │
│  [FindMy Web App / PWA (Leaflet + Google Maps Deep)]   │
└────────────────────────────────────────────────────────┘
```
