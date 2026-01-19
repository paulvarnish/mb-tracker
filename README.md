# ManageBac Tracker Extension

A Chrome extension that helps track task completion status on ManageBac calendar pages. Mark tasks as complete/incomplete with checkboxes and optionally hide completed tasks.

## Features

- ✅ **Task Completion Tracking** - Click checkboxes to mark tasks as complete/incomplete
- 💾 **Local Storage** - All data stored locally in your browser (no server required)
- 👁️ **Hide Completed Tasks** - Toggle to show/hide completed tasks on the calendar
- 🔄 **Dynamic Updates** - Automatically processes tasks added to the page
- 📦 **Automatic Cleanup** - Maintains up to 10,000 completed tasks, auto-removing oldest when full

## Structure

- `manifest.json` - Extension configuration and permissions
- `content.js` - Main script that runs on ManageBac calendar pages
- `styles.css` - Styling for injected checkboxes and toggle
- `background.js` - (No longer used, can be deleted)

## Setup Instructions

### 1. Configure the Extension (Optional)

The extension is pre-configured for ManageBac. You can adjust settings in `content.js`:

**CONFIG options:**
- `targetClass` - CSS class of calendar event elements (default: `"fc-event"`)
- `hrefPattern` - Regex to extract task IDs from URLs (default: `/\/(\d+)$/`)
- `storageKey` - Chrome storage key for completed tasks (default: `"completedTasks"`)
- `maxStorageItems` - Maximum tasks before cleanup (default: `10000`)

### 2. Add Icons (Optional)

Create an `icons` folder and add icon files:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

Or remove the icons section from manifest.json if you don't need them yet.

### 3. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this directory
5. The extension will now be active!

### 4. Usage

1. Navigate to any ManageBac calendar page (URL must include `/calendar`)
2. Look for checkboxes next to calendar events
3. Click checkboxes to mark tasks as complete (green checkmark) or incomplete (gray box)
4. Use the "Hide completed" toggle in the calendar toolbar to show/hide completed tasks

## How It Works

### Storage
- All task completion data is stored in `chrome.storage.local`
- Data persists across browser sessions and extension updates
- Storage format: `{ "taskId": timestamp }` for each completed task
- When storage reaches 10,000 items, the oldest 50% are automatically removed

### Task Processing
1. Extension scans the page for elements with class `fc-event`
2. Extracts task ID from the element's `href` attribute
3. Checks chrome.storage to see if task is marked complete
4. Injects a checkbox button with appropriate state
5. MutationObserver watches for dynamically added tasks

### Toggle Feature
- A "Hide completed" toggle is added to the calendar toolbar
- When enabled, tasks marked as complete are hidden from view
- Toggle state is not persisted (resets on page reload)

## Data Management

### View Storage Data
Open Chrome DevTools Console on any ManageBac page and run:
```javascript
chrome.storage.local.get('completedTasks', (result) => {
  console.log('Completed tasks:', result.completedTasks);
  console.log('Total count:', Object.keys(result.completedTasks || {}).length);
});
```

### Clear All Data
```javascript
chrome.storage.local.remove('completedTasks', () => {
  console.log('All completion data cleared');
});
```

## Troubleshooting

**Extension not running:**
- Verify you're on a ManageBac calendar page (URL includes `/calendar`)
- Check that the extension is enabled in `chrome://extensions/`
- Reload the extension after making any code changes
- Check DevTools Console (F12) for error messages

**Checkboxes not appearing:**
- Verify calendar events have class `fc-event`
- Check that events have valid `href` attributes with numeric IDs
- Look for error messages in DevTools Console

**Storage issues:**
- Check Chrome's storage quota hasn't been exceeded
- Verify the "storage" permission is in manifest.json
- Try clearing extension data and reloading

## Development Tips

- Always reload the extension in `chrome://extensions/` after code changes
- Use `console.log()` statements for debugging (check DevTools Console)
- Extension only runs on pages matching `https://*.managebac.com/*`
- Test on different calendar views (month, week, day) to ensure compatibility
