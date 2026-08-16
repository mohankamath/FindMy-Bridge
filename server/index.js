import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { config } from './config.js';
import { FindMyParser } from './findmyParser.js';
import { MacRefresher } from './macRefresher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const parser = new FindMyParser();
const refresher = new MacRefresher();

let latestData = null;
let lastDataHash = '';

// Authentication Middleware (if AUTH_TOKEN is set)
function authMiddleware(req, res, next) {
  if (!config.authToken) return next();

  const authHeader = req.headers.authorization;
  const queryToken = req.query.token;
  const providedToken = authHeader?.replace(/^Bearer\s+/i, '') || queryToken;

  if (providedToken === config.authToken) {
    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Valid authentication token required. Configure AUTH_TOKEN or provide in Authorization header.'
  });
}

app.use(cors());
app.use(express.json());

// Public static frontend
app.use(express.static(publicDir));

// API Routes
app.get('/api/status', async (req, res) => {
  const cacheStatus = await parser.checkCacheAccess();
  res.json({
    status: 'online',
    isMacOS: config.isMacOS,
    mockMode: config.mockData,
    authRequired: Boolean(config.authToken),
    cache: cacheStatus,
    stats: {
      itemsCount: latestData?.itemsCount || 0,
      devicesCount: latestData?.devicesCount || 0,
      totalCount: latestData?.totalCount || 0,
      lastUpdated: latestData?.updatedAt || null
    },
    uptime: Math.floor(process.uptime())
  });
});

app.get('/api/debug', async (req, res) => {
  try {
    const fs = await import('fs/promises');
    let dirFiles = [];
    try {
      dirFiles = await fs.readdir(config.cacheDir);
    } catch (e) {
      dirFiles = `Error reading dir: ${e.message}`;
    }

    const items = await parser.readItems();
    const devices = await parser.readDevices();

    res.json({
      cacheDir: config.cacheDir,
      dirFiles,
      parsedCounts: {
        items: items.length,
        devices: devices.length
      },
      sampleItem: items[0] || null,
      sampleDevice: devices[0] || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

app.get('/api/all', authMiddleware, async (req, res) => {
  try {
    const data = await parser.getAll();
    latestData = data;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve Find My data', details: err.message });
  }
});

app.get('/api/items', authMiddleware, async (req, res) => {
  try {
    const items = await parser.readItems();
    res.json({ count: items.length, items });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve items', details: err.message });
  }
});

app.get('/api/devices', authMiddleware, async (req, res) => {
  try {
    const devices = await parser.readDevices();
    res.json({ count: devices.length, devices });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve devices', details: err.message });
  }
});

app.post('/api/refresh', authMiddleware, async (req, res) => {
  try {
    const refreshResult = await refresher.triggerRefresh();
    // Wait a brief moment then re-fetch
    setTimeout(async () => {
      await pollAndBroadcast();
    }, 1500);
    res.json({ success: true, macRefresh: refreshResult });
  } catch (err) {
    res.status(500).json({ error: 'Refresh failed', details: err.message });
  }
});

// Fallback for PWA single page navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// WebSocket Live Broadcast
function broadcast(payload) {
  const message = JSON.stringify(payload);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      if (config.authToken && !client.isAuthenticated) {
        return;
      }
      client.send(message);
    }
  });
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const queryToken = url.searchParams.get('token');

  if (config.authToken) {
    if (queryToken === config.authToken) {
      ws.isAuthenticated = true;
    } else {
      ws.isAuthenticated = false;
      // Allow client to authenticate via initial message
    }
  } else {
    ws.isAuthenticated = true;
  }

  // Send current cached data immediately upon connection
  if (ws.isAuthenticated && latestData) {
    ws.send(JSON.stringify({ type: 'update', data: latestData }));
  }

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'auth') {
        if (!config.authToken || msg.token === config.authToken) {
          ws.isAuthenticated = true;
          ws.send(JSON.stringify({ type: 'auth_success' }));
          if (latestData) {
            ws.send(JSON.stringify({ type: 'update', data: latestData }));
          }
        } else {
          ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }));
        }
      } else if (msg.type === 'request_refresh') {
        if (ws.isAuthenticated) {
          await refresher.triggerRefresh();
          await pollAndBroadcast();
        }
      }
    } catch (e) {
      // Ignore malformed message
    }
  });
});

// Background Poller: reads cache file every interval and broadcasts when changed
async function pollAndBroadcast() {
  try {
    const data = await parser.getAll();
    const hash = JSON.stringify(data.all.map(d => ({
      id: d.id,
      ts: d.location.timestamp,
      lat: d.location.latitude,
      lon: d.location.longitude,
      bat: d.battery.percent
    })));

    latestData = data;

    if (hash !== lastDataHash) {
      lastDataHash = hash;
      broadcast({ type: 'update', data });
    }
  } catch (err) {
    console.warn(`[Poller] Poll check note: ${err.message}`);
  }
}

// Start Server
async function start() {
  // Initial load
  await pollAndBroadcast();

  // Start macOS auto-refresher
  refresher.start();

  // Start polling timer
  setInterval(pollAndBroadcast, config.pollIntervalMs);

  server.listen(config.port, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(` 🧭 FindMy Android Bridge is running!`);
    console.log(`-------------------------------------------------------`);
    console.log(` 📍 Local Access:     http://localhost:${config.port}`);
    console.log(` 📱 LAN / Wi-Fi:      http://<YOUR-MAC-IP>:${config.port}`);
    console.log(` 🌐 Tailscale Funnel: Accessible via your Tailscale domain`);
    if (config.authToken) {
      console.log(` 🔒 Auth:             Token authentication is ENABLED`);
    } else {
      console.log(` ⚠️  Auth:             No AUTH_TOKEN set in .env (Open access)`);
    }
    console.log(` 💻 Platform:         ${process.platform} (macOS mode: ${config.isMacOS})`);
    console.log(`=======================================================`);
  });
}

start().catch(err => {
  console.error('Failed to start FindMy Bridge server:', err);
  process.exit(1);
});
