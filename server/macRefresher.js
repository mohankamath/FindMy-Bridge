import { exec } from 'child_process';
import util from 'util';
import { config } from './config.js';

const execPromise = util.promisify(exec);

export class MacRefresher {
  constructor() {
    this.timer = null;
    this.isRefreshing = false;
    this.lastRefreshedAt = null;
  }

  start() {
    if (!config.isMacOS || !config.enableMacRefresh) {
      return;
    }

    const intervalMs = Math.max(1, config.refreshIntervalMinutes) * 60 * 1000;
    console.log(`[MacRefresher] Auto-refresh active (interval: ${config.refreshIntervalMinutes}m)`);

    this.timer = setInterval(() => {
      this.triggerRefresh().catch(err => {
        console.warn(`[MacRefresher] Background refresh notice:`, err.message);
      });
    }, intervalMs);

    // Initial trigger after 10 seconds
    setTimeout(() => {
      this.triggerRefresh().catch(() => {});
    }, 10000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async triggerRefresh() {
    if (this.isRefreshing) return { success: false, reason: 'already_refreshing' };
    if (!config.isMacOS) return { success: true, reason: 'non_mac_platform' };

    this.isRefreshing = true;
    try {
      // Gently wake Find My in background without stealing active focus
      // Uses AppleScript or 'open -g -j -a FindMy'
      const script = `
        try
          tell application "Find My" to activate
          delay 0.5
          tell application "System Events" to set visible of process "Find My" to false
        end try
      `;
      
      await execPromise(`osascript -e '${script.replace(/\n/g, ' ')}'`);
      this.lastRefreshedAt = new Date().toISOString();
      return { success: true, timestamp: this.lastRefreshedAt };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      this.isRefreshing = false;
    }
  }
}
