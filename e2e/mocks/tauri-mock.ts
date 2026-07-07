/**
 * Tauri API mock for Playwright E2E tests.
 *
 * Injected via page.addInitScript() before any page scripts run.
 * Sets up window.__TAURI_INTERNALS__ with invoke and transformCallback
 * so all @tauri-apps/api/* and @tauri-apps/plugin-* modules work in a browser.
 */
export const tauriMockScript = `
(function () {
  // --- Callback registry for transformCallback ---
  var callbacks = {};
  var callbackId = 0;

  // --- Mock data store ---
  var mockPreferences = {
    theme: 'system',
    quick_pane_shortcut: null,
    language: null,
    crash_reporting_consent: null,
  };

  var crashReportData = null;
  var registeredChannels = [];
  var autostartEnabled = false;
  var invokeLog = [];

  // --- transformCallback implementation ---
  function transformCallback(callback, once) {
    var id = ++callbackId;
    callbacks[id] = { callback: callback, once: once };
    return id;
  }

  // --- invoke implementation ---
  function invoke(cmd, args, options) {
    invokeLog.push(cmd);
    return new Promise(function (resolve, reject) {
      args = args || {};

      // --- User commands ---
      if (cmd === 'load_preferences') {
        resolve(mockPreferences);
        return;
      }
      if (cmd === 'save_preferences') {
        Object.assign(mockPreferences, args.preferences);
        resolve(null);
        return;
      }
      if (cmd === 'greet') {
        resolve('Hello, ' + args.name + '!');
        return;
      }
      if (cmd === 'read_crash_report') {
        resolve(crashReportData);
        return;
      }
      if (cmd === 'delete_crash_report') {
        crashReportData = null;
        resolve(null);
        return;
      }
      if (cmd === 'cleanup_old_recovery_files') {
        resolve(0);
        return;
      }
      if (cmd === 'get_default_quick_pane_shortcut') {
        resolve('CommandOrControl+Shift+.');
        return;
      }
      if (cmd === 'update_quick_pane_shortcut' || cmd === 'set_quick_pane_shortcut') {
        resolve(null);
        return;
      }
      if (cmd === 'register_quick_pane_shortcut' || cmd === 'unregister_quick_pane_shortcut') {
        resolve(null);
        return;
      }
      if (cmd === 'show_quick_pane' || cmd === 'dismiss_quick_pane' || cmd === 'toggle_quick_pane') {
        resolve(null);
        return;
      }
      if (cmd === 'set_tray_icon_state' || cmd === 'move_window_to_tray') {
        resolve(null);
        return;
      }
      if (cmd === 'send_native_notification') {
        resolve(null);
        return;
      }
      if (cmd === 'save_emergency_data' || cmd === 'load_emergency_data') {
        resolve(null);
        return;
      }

      // --- Plugin: event ---
      if (cmd === 'plugin:event|listen') {
        // Tauri 2.0 listen passes { event, target, handler } where
        // handler is a callback ID registered via transformCallback.
        // Also support legacy channel-based approach.
        var entry = { event: args.event, channel: null, handlerId: null };
        if (args.handler && typeof args.handler === 'number') {
          entry.handlerId = args.handler;
        }
        if (args.channel) {
          entry.channel = args.channel;
        }
        registeredChannels.push(entry);
        resolve(callbackId);
        return;
      }
      if (cmd === 'plugin:event|unlisten' || cmd === 'plugin:event|emit' || cmd === 'plugin:event|once') {
        resolve(null);
        return;
      }

      // --- Plugin: window ---
      if (cmd.indexOf('plugin:window|') === 0) {
        if (cmd.indexOf('is_fullscreen') !== -1) { resolve(false); return; }
        if (cmd.indexOf('is_maximized') !== -1) { resolve(false); return; }
        if (cmd.indexOf('is_visible') !== -1) { resolve(true); return; }
        if (cmd.indexOf('theme') !== -1) { resolve('light'); return; }
        if (cmd.indexOf('label') !== -1) { resolve('main'); return; }
        resolve(null);
        return;
      }

      // --- Plugin: webview ---
      if (cmd.indexOf('plugin:webview|') === 0) {
        resolve(null);
        return;
      }

      // --- Plugin: os ---
      if (cmd === 'plugin:os|locale') { resolve('en-US'); return; }
      if (cmd === 'plugin:os|platform') { resolve('windows'); return; }
      if (cmd.indexOf('plugin:os|') === 0) { resolve(null); return; }

      // --- Plugin: deep-link ---
      if (cmd === 'plugin:deep-link|get_current') { resolve([]); return; }
      if (cmd.indexOf('plugin:deep-link|') === 0) { resolve(null); return; }

      // --- Plugin: updater ---
      if (cmd === 'plugin:updater|check') { resolve(null); return; }
      if (cmd.indexOf('plugin:updater|') === 0) { resolve(null); return; }

      // --- Plugin: global-shortcut ---
      if (cmd.indexOf('plugin:global-shortcut|') === 0) { resolve(null); return; }

      // --- Plugin: autostart ---
      if (cmd === 'plugin:autostart|is_enabled') { resolve(autostartEnabled); return; }
      if (cmd === 'plugin:autostart|enable') { autostartEnabled = true; resolve(null); return; }
      if (cmd === 'plugin:autostart|disable') { autostartEnabled = false; resolve(null); return; }
      if (cmd.indexOf('plugin:autostart|') === 0) { resolve(null); return; }

      // --- Plugin: notification ---
      if (cmd.indexOf('plugin:notification|') === 0) { resolve(null); return; }

      // --- Plugin: menu ---
      if (cmd === 'plugin:menu|new') { resolve(1); return; }
      if (cmd.indexOf('plugin:menu|') === 0) { resolve(null); return; }

      // --- Plugin: log ---
      if (cmd.indexOf('plugin:log|') === 0) { resolve(null); return; }

      // --- Plugin: process ---
      if (cmd.indexOf('plugin:process|') === 0) { resolve(null); return; }

      // --- Plugin: clipboard-manager ---
      if (cmd.indexOf('plugin:clipboard-manager|') === 0) { resolve(null); return; }

      // --- Plugin: dialog ---
      if (cmd.indexOf('plugin:dialog|') === 0) { resolve(null); return; }

      // --- Plugin: fs ---
      if (cmd.indexOf('plugin:fs|') === 0) { resolve(null); return; }

      // --- Plugin: opener ---
      if (cmd.indexOf('plugin:opener|') === 0) { resolve(null); return; }

      // --- Default ---
      console.warn('[Tauri Mock] Unhandled command: ' + cmd);
      resolve(null);
    });
  }

  // --- Set up __TAURI_INTERNALS__ ---
  window.__TAURI_INTERNALS__ = {
    invoke: invoke,
    transformCallback: transformCallback,
    convertFileSrc: function (path) { return path; },
  };

  // --- Test helpers ---
  window.__testHelpers = {
    setCrashReport: function (data) { crashReportData = data; },
    getPreferences: function () { return JSON.parse(JSON.stringify(mockPreferences)); },
    setPreferences: function (prefs) { Object.assign(mockPreferences, prefs); },
    emitEvent: function (eventName, payload) {
      registeredChannels.forEach(function (entry) {
        if (entry.event === eventName) {
          var data = { event: eventName, payload: payload, id: 0 };
          // Tauri 2.0: handler is a callback ID from transformCallback
          if (entry.handlerId != null && callbacks[entry.handlerId]) {
            callbacks[entry.handlerId].callback(data);
          }
          // Legacy: direct onmessage (original Channel object)
          else if (entry.channel && typeof entry.channel.onmessage === 'function') {
            entry.channel.onmessage(data);
          }
          // Legacy: serialized Channel with callbackId
          else if (entry.channel && entry.channel.callbackId && callbacks[entry.channel.callbackId]) {
            callbacks[entry.channel.callbackId].callback(data);
          }
        }
      });
    },
    getRegisteredChannels: function () {
      return registeredChannels.map(function (e) { return e.event; });
    },
    getInvokeLog: function () {
      return invokeLog.slice();
    },
  };
})();
`
