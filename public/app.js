// FindMy Android Bridge Client Logic

class FindMyApp {
  constructor() {
    this.items = [];
    this.devices = [];
    this.allData = [];
    this.selectedItem = null;
    this.activeFilter = 'all';
    this.searchQuery = '';
    this.userLocation = null;
    this.markers = new Map();
    this.accuracyCircles = new Map();
    this.userMarker = null;
    this.authToken = localStorage.getItem('findmy_auth_token') || '';
    
    this.initElements();
    this.initMap();
    this.initEvents();
    this.initGeolocation();
    this.initWebSocket();
    this.fetchInitialData();
  }

  initElements() {
    this.statusBadge = document.getElementById('connection-badge');
    this.statusText = document.getElementById('status-text');
    this.cardsList = document.getElementById('cards-list');
    this.searchInput = document.getElementById('search-input');
    this.searchClear = document.getElementById('search-clear');
    this.chips = document.querySelectorAll('.chip');
    this.countAll = document.getElementById('count-all');
    this.countItems = document.getElementById('count-items');
    this.countDevices = document.getElementById('count-devices');
    this.countTotalFloat = document.getElementById('count-total-float');
    this.lastSyncLabel = document.getElementById('last-sync-label');
    this.drawer = document.getElementById('device-drawer');
    this.drawerHandle = document.getElementById('drawer-handle');
    
    // Modal elements
    this.detailModal = document.getElementById('detail-modal');
    this.modalClose = document.getElementById('modal-close');
    this.modalEmoji = document.getElementById('modal-emoji');
    this.modalTitle = document.getElementById('modal-title');
    this.modalSubtitle = document.getElementById('modal-subtitle');
    this.modalBattery = document.getElementById('modal-battery');
    this.modalAccuracy = document.getElementById('modal-accuracy');
    this.modalDistance = document.getElementById('modal-distance');
    this.modalStatus = document.getElementById('modal-status');
    this.modalAddress = document.getElementById('modal-address');
    this.btnGoogleMaps = document.getElementById('btn-google-maps');
    this.btnCopyAddress = document.getElementById('btn-copy-address');
    this.btnShare = document.getElementById('btn-share');
    this.btnFocusMap = document.getElementById('btn-focus-map');

    // Auth Modal
    this.authModal = document.getElementById('auth-modal');
    this.btnAuthSettings = document.getElementById('btn-auth-settings');
    this.authModalClose = document.getElementById('auth-modal-close');
    this.tokenInput = document.getElementById('token-input');
    this.btnSaveToken = document.getElementById('btn-save-token');
    this.btnClearToken = document.getElementById('btn-clear-token');

    // Action buttons
    this.btnRefresh = document.getElementById('btn-refresh');
    this.btnMyLocation = document.getElementById('btn-my-location');
    this.toastEl = document.getElementById('toast');
  }

  initMap() {
    // Default center (will adjust to bounding box of items)
    this.map = L.map('map-container', {
      zoomControl: false,
      attributionControl: false
    }).setView([40.7580, -73.9855], 13);

    // High quality Dark Matter map tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(this.map);

    // Zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
  }

  initEvents() {
    // Search
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.searchClear.classList.toggle('hidden', !this.searchQuery);
      this.renderList();
    });

    this.searchClear.addEventListener('click', () => {
      this.searchInput.value = '';
      this.searchQuery = '';
      this.searchClear.classList.add('hidden');
      this.renderList();
    });

    // Filter Chips
    this.chips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeFilter = chip.dataset.filter;
        this.renderList();
      });
    });

    // Refresh Button
    this.btnRefresh.addEventListener('click', async () => {
      this.btnRefresh.classList.add('spinning');
      this.showToast('Requesting refresh from MacBook...');
      try {
        const res = await fetch('/api/refresh', {
          method: 'POST',
          headers: this.getAuthHeaders()
        });
        if (res.ok) {
          this.showToast('Refresh triggered!');
        } else {
          this.showToast('Refresh request failed', 'error');
        }
      } catch (err) {
        this.showToast('Connection error', 'error');
      } finally {
        setTimeout(() => this.btnRefresh.classList.remove('spinning'), 1000);
      }
    });

    // My Location Button
    this.btnMyLocation.addEventListener('click', () => {
      if (this.userLocation) {
        this.map.flyTo([this.userLocation.lat, this.userLocation.lng], 16);
        this.showToast('Centered on your phone');
      } else {
        this.initGeolocation(true);
      }
    });

    // Mobile Drawer Expand/Collapse
    if (this.drawerHandle) {
      this.drawerHandle.addEventListener('click', () => {
        this.drawer.classList.toggle('expanded');
      });
    }

    // Modal Close
    this.modalClose.addEventListener('click', () => this.hideDetailModal());
    this.detailModal.addEventListener('click', (e) => {
      if (e.target === this.detailModal) this.hideDetailModal();
    });

    // Auth Modal
    this.btnAuthSettings.addEventListener('click', () => {
      this.tokenInput.value = this.authToken;
      this.authModal.classList.remove('hidden');
    });

    this.authModalClose.addEventListener('click', () => {
      this.authModal.classList.add('hidden');
    });

    this.btnSaveToken.addEventListener('click', () => {
      this.authToken = this.tokenInput.value.trim();
      if (this.authToken) {
        localStorage.setItem('findmy_auth_token', this.authToken);
      } else {
        localStorage.removeItem('findmy_auth_token');
      }
      this.authModal.classList.add('hidden');
      this.showToast('Saved token. Reconnecting...');
      this.initWebSocket();
      this.fetchInitialData();
    });

    this.btnClearToken.addEventListener('click', () => {
      this.authToken = '';
      localStorage.removeItem('findmy_auth_token');
      this.tokenInput.value = '';
      this.authModal.classList.add('hidden');
      this.showToast('Token cleared');
      this.fetchInitialData();
    });

    // Copy Address
    this.btnCopyAddress.addEventListener('click', () => {
      if (this.selectedItem) {
        const text = `${this.selectedItem.name}: ${this.selectedItem.address.formatted} (${this.selectedItem.location.latitude}, ${this.selectedItem.location.longitude})`;
        navigator.clipboard.writeText(text);
        this.showToast('Copied address to clipboard!');
      }
    });

    // Share Location
    this.btnShare.addEventListener('click', async () => {
      if (!this.selectedItem) return;
      const { name, location, address } = this.selectedItem;
      const url = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
      
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Find My: ${name}`,
            text: `${name} at ${address.formatted}`,
            url
          });
        } catch (e) {
          // User cancelled
        }
      } else {
        navigator.clipboard.writeText(url);
        this.showToast('Location link copied!');
      }
    });

    // Focus Map from Modal
    this.btnFocusMap.addEventListener('click', () => {
      if (this.selectedItem) {
        this.hideDetailModal();
        if (window.innerWidth <= 768) {
          this.drawer.classList.remove('expanded');
        }
        this.focusOnItem(this.selectedItem);
      }
    });
  }

  getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  initGeolocation(prompt = false) {
    if (!('geolocation' in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.userLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        this.updateUserMarker();
        this.renderList();
        if (prompt) {
          this.map.flyTo([this.userLocation.lat, this.userLocation.lng], 16);
          this.showToast('Location updated');
        }
      },
      (err) => {
        if (prompt) this.showToast('Could not get phone GPS location', 'error');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  updateUserMarker() {
    if (!this.userLocation) return;
    const latlng = [this.userLocation.lat, this.userLocation.lng];

    if (!this.userMarker) {
      const userIcon = L.divIcon({
        className: 'user-phone-pin',
        html: `
          <div style="width: 18px; height: 18px; border-radius: 50%; background: #007aff; border: 3px solid #fff; box-shadow: 0 0 10px rgba(0, 122, 255, 0.8);"></div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      this.userMarker = L.marker(latlng, { icon: userIcon, zIndexOffset: 1000 }).addTo(this.map);
    } else {
      this.userMarker.setLatLng(latlng);
    }
  }

  initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const tokenParam = this.authToken ? `?token=${encodeURIComponent(this.authToken)}` : '';
    const wsUrl = `${protocol}//${window.location.host}/ws${tokenParam}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.setConnected(true);
        if (this.authToken) {
          this.ws.send(JSON.stringify({ type: 'auth', token: this.authToken }));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'update' && msg.data) {
            this.handleDataUpdate(msg.data);
          } else if (msg.type === 'auth_error') {
            this.showToast('Auth error: Invalid token', 'error');
            this.authModal.classList.remove('hidden');
          }
        } catch (e) {}
      };

      this.ws.onclose = () => {
        this.setConnected(false);
        // Retry connection after 4 seconds
        setTimeout(() => this.initWebSocket(), 4000);
      };

      this.ws.onerror = () => {
        this.setConnected(false);
      };
    } catch (err) {
      this.setConnected(false);
    }
  }

  setConnected(isConnected) {
    if (isConnected) {
      this.statusBadge.className = 'status-indicator-badge connected';
      this.statusText.textContent = 'Live (Connected)';
    } else {
      this.statusBadge.className = 'status-indicator-badge error';
      this.statusText.textContent = 'Reconnecting...';
    }
  }

  async fetchInitialData() {
    try {
      const res = await fetch('/api/all', {
        headers: this.getAuthHeaders()
      });
      if (res.status === 401) {
        this.authModal.classList.remove('hidden');
        this.showToast('Please enter your authentication token', 'error');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        this.handleDataUpdate(data);
      }
    } catch (err) {
      console.warn('Initial fetch note:', err);
    }
  }

  handleDataUpdate(data) {
    this.items = data.items || [];
    this.devices = data.devices || [];
    this.allData = data.all || [...this.items, ...this.devices];

    this.countAll.textContent = this.allData.length;
    this.countItems.textContent = this.items.length;
    this.countDevices.textContent = this.devices.length;
    this.countTotalFloat.textContent = this.allData.length;
    
    if (data.updatedAt) {
      const d = new Date(data.updatedAt);
      this.lastSyncLabel.textContent = `Updated ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }

    this.updateMapMarkers();
    this.renderList();
  }

  getFilteredData() {
    return this.allData.filter(item => {
      // Filter tab
      if (this.activeFilter === 'items' && item.type !== 'item') return false;
      if (this.activeFilter === 'devices' && item.type !== 'device') return false;

      // Search
      if (this.searchQuery) {
        const str = `${item.name} ${item.category} ${item.productType} ${item.address.formatted}`.toLowerCase();
        if (!str.includes(this.searchQuery)) return false;
      }
      return true;
    });
  }

  updateMapMarkers() {
    const activeIds = new Set();
    const bounds = [];

    this.allData.forEach(item => {
      const { id, name, emoji, location, type, battery } = item;
      if (!location || !location.latitude || !location.longitude) return;

      const latlng = [location.latitude, location.longitude];
      bounds.push(latlng);
      activeIds.add(id);

      // Create Custom Pin Icon
      const isSelected = this.selectedItem && this.selectedItem.id === id;
      const isLowBat = battery.status === 'low' || battery.percent <= 20;

      const pinHtml = `
        <div class="custom-pin ${type} ${isSelected ? 'selected' : ''} ${isLowBat ? 'low-battery' : ''}" title="${name}">
          ${emoji || '📍'}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-pin-wrapper',
        html: pinHtml,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      if (this.markers.has(id)) {
        const marker = this.markers.get(id);
        marker.setLatLng(latlng);
        marker.setIcon(customIcon);
      } else {
        const marker = L.marker(latlng, { icon: customIcon }).addTo(this.map);
        marker.on('click', () => {
          this.selectItem(item);
        });
        this.markers.set(id, marker);
      }

      // Accuracy circle
      const accuracyRadius = Math.max(10, location.accuracy || 15);
      if (this.accuracyCircles.has(id)) {
        const circle = this.accuracyCircles.get(id);
        circle.setLatLng(latlng);
        circle.setRadius(accuracyRadius);
      } else {
        const circle = L.circle(latlng, {
          radius: accuracyRadius,
          className: 'accuracy-circle'
        }).addTo(this.map);
        this.accuracyCircles.set(id, circle);
      }
    });

    // Cleanup deleted markers
    this.markers.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        this.map.removeLayer(marker);
        this.markers.delete(id);
      }
    });

    this.accuracyCircles.forEach((circle, id) => {
      if (!activeIds.has(id)) {
        this.map.removeLayer(circle);
        this.accuracyCircles.delete(id);
      }
    });

    // Fit map bounds on first load if bounds exist
    if (bounds.length > 0 && !this.hasFittedBounds) {
      this.map.fitBounds(L.latLngBounds(bounds).pad(0.2));
      this.hasFittedBounds = true;
    }
  }

  renderList() {
    const filtered = this.getFilteredData();

    if (filtered.length === 0) {
      this.cardsList.innerHTML = `
        <div class="loading-placeholder">
          <p>No items found matching criteria.</p>
        </div>
      `;
      return;
    }

    this.cardsList.innerHTML = filtered.map(item => {
      const isSelected = this.selectedItem && this.selectedItem.id === item.id;
      const relativeTime = this.formatRelativeTime(item.location.timestamp);
      const distance = this.calculateDistance(item.location);
      const batteryPill = this.renderBatteryPill(item.battery);

      return `
        <div class="item-card ${isSelected ? 'active' : ''}" data-id="${item.id}">
          <div class="item-icon-box">${item.emoji || '📍'}</div>
          <div class="item-info-col">
            <div class="item-name-row">
              <span class="item-title">${this.escapeHtml(item.name)}</span>
              <span class="item-time">${relativeTime}</span>
            </div>
            <div class="item-location-sub">${this.escapeHtml(item.address.formatted || 'Location tracking')}</div>
            <div class="item-meta-row">
              ${batteryPill}
              ${distance ? `<span class="distance-pill">🧭 ${distance}</span>` : ''}
              <span>±${Math.round(item.location.accuracy || 10)}m</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to cards
    this.cardsList.querySelectorAll('.item-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const item = this.allData.find(i => i.id === id);
        if (item) {
          this.selectItem(item);
        }
      });
    });
  }

  selectItem(item) {
    this.selectedItem = item;
    this.renderList();
    this.updateMapMarkers();
    this.showDetailModal(item);
    this.focusOnItem(item);
  }

  focusOnItem(item) {
    if (item.location && item.location.latitude && item.location.longitude) {
      this.map.flyTo([item.location.latitude, item.location.longitude], 17, {
        duration: 0.8
      });
    }
  }

  showDetailModal(item) {
    const { name, emoji, category, productType, modelName, battery, location, address } = item;

    this.modalEmoji.textContent = emoji || '📍';
    this.modalTitle.textContent = name;
    this.modalSubtitle.textContent = `${modelName || productType || category} • ${this.formatRelativeTime(location.timestamp)}`;
    
    // Battery info
    const batStr = battery.isCharging ? `⚡ ${battery.percent}% (Charging)` : `${battery.percent}% (${battery.status})`;
    this.modalBattery.textContent = batStr;
    
    // Accuracy
    this.modalAccuracy.textContent = `±${Math.round(location.accuracy || 10)} meters`;

    // Distance from phone
    const distStr = this.calculateDistance(location);
    this.modalDistance.textContent = distStr ? `${distStr} away` : 'GPS unavailable';

    // Status
    this.modalStatus.textContent = item.isLost ? '⚠️ Lost Mode' : (location.isOld ? 'Old Report' : 'Active');

    // Address
    this.modalAddress.textContent = address.formatted || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;

    // Google Maps Navigation Deep Link
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
    this.btnGoogleMaps.href = googleMapsUrl;

    this.detailModal.classList.remove('hidden');
  }

  hideDetailModal() {
    this.detailModal.classList.add('hidden');
  }

  renderBatteryPill(battery) {
    if (!battery) return '';
    let pillClass = '';
    let icon = '🔋';

    if (battery.isCharging) {
      pillClass = 'charging';
      icon = '⚡';
    } else if (battery.percent <= 20 || battery.status === 'low' || battery.status === 'critically_low') {
      pillClass = 'low';
      icon = '🪫';
    }

    return `<span class="battery-pill ${pillClass}">${icon} ${battery.percent}%</span>`;
  }

  calculateDistance(targetLoc) {
    if (!this.userLocation || !targetLoc || !targetLoc.latitude) return null;

    const R = 6371e3; // Earth radius in meters
    const lat1 = (this.userLocation.lat * Math.PI) / 180;
    const lat2 = (targetLoc.latitude * Math.PI) / 180;
    const deltaLat = ((targetLoc.latitude - this.userLocation.lat) * Math.PI) / 180;
    const deltaLon = ((targetLoc.longitude - this.userLocation.lng) * Math.PI) / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;

    if (d < 1000) {
      return `${Math.round(d)} m`;
    }
    return `${(d / 1000).toFixed(1)} km`;
  }

  formatRelativeTime(timestamp) {
    if (!timestamp) return 'Unknown';
    const now = Date.now();
    const diffSec = Math.floor((now - timestamp) / 1000);

    if (diffSec < 45) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  }

  showToast(message, type = 'normal') {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastEl.textContent = message;
    this.toastEl.style.borderColor = type === 'error' ? 'var(--accent-red)' : 'var(--border-subtle)';
    this.toastEl.classList.remove('hidden');
    
    this.toastTimeout = setTimeout(() => {
      this.toastEl.classList.add('hidden');
    }, 3000);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW registration note:', err.message);
    });
  });
}

// Boot application
window.addEventListener('DOMContentLoaded', () => {
  window.findMyApp = new FindMyApp();
});
