// Configuration
const CONFIG = {
  targetClass: "fc-event",
  hrefPattern: /\/(\d+)$/, // Extract final number from href path
  storageKey: "completedTasks", // Key for chrome.storage
  maxStorageItems: 10000, // Max items before cleanup
};

/**
 * Extract task ID from href attribute
 * @param {string} href - The href attribute value
 * @returns {string|null} - Extracted task ID or null
 */
function extractIdFromHref(href) {
  const match = href.match(CONFIG.hrefPattern);
  return match ? match[1] : null;
}

/**
 * Get completed tasks from chrome.storage
 * @returns {Promise<object>} - Object with taskId as key and timestamp as value
 */
async function getCompletedTasks() {
  try {
    const result = await chrome.storage.local.get(CONFIG.storageKey);
    return result[CONFIG.storageKey] || {};
  } catch (error) {
    console.error("Error reading from storage:", error);
    return {};
  }
}

/**
 * Check if a task is completed
 * @param {string} taskId - The task ID
 * @returns {Promise<boolean>} - True if task is completed
 */
async function isTaskCompleted(taskId) {
  const completedTasks = await getCompletedTasks();
  return taskId in completedTasks;
}

/**
 * Mark a task as completed
 * @param {string} taskId - The task ID
 * @returns {Promise<boolean>} - True if successful
 */
async function markTaskCompleted(taskId) {
  try {
    const completedTasks = await getCompletedTasks();
    completedTasks[taskId] = Date.now();

    // Check if storage is getting full and cleanup if needed
    await cleanupStorageIfNeeded(completedTasks);

    await chrome.storage.local.set({ [CONFIG.storageKey]: completedTasks });
    console.log(`Task ${taskId} marked as completed`);
    return true;
  } catch (error) {
    console.error("Error marking task as completed:", error);
    return false;
  }
}

/**
 * Mark a task as todo (remove from completed)
 * @param {string} taskId - The task ID
 * @returns {Promise<boolean>} - True if successful
 */
async function markTaskTodo(taskId) {
  try {
    const completedTasks = await getCompletedTasks();
    delete completedTasks[taskId];
    await chrome.storage.local.set({ [CONFIG.storageKey]: completedTasks });
    console.log(`Task ${taskId} marked as todo`);
    return true;
  } catch (error) {
    console.error("Error marking task as todo:", error);
    return false;
  }
}

/**
 * Cleanup storage if it exceeds max items
 * Removes the earliest half of completed tasks
 * @param {object} completedTasks - Current completed tasks object
 */
async function cleanupStorageIfNeeded(completedTasks) {
  const taskCount = Object.keys(completedTasks).length;

  if (taskCount >= CONFIG.maxStorageItems) {
    console.log(`Storage limit reached (${taskCount} items), cleaning up...`);

    // Sort by timestamp (oldest first)
    const sortedEntries = Object.entries(completedTasks).sort(
      (a, b) => a[1] - b[1]
    );

    // Keep the newest half
    const keepCount = Math.floor(taskCount / 2);
    const entriesToKeep = sortedEntries.slice(-keepCount);

    const newCompletedTasks = Object.fromEntries(entriesToKeep);
    await chrome.storage.local.set({ [CONFIG.storageKey]: newCompletedTasks });

    console.log(`Cleaned up storage: removed ${taskCount - keepCount} oldest tasks`);
  }
}

/**
 * Create and inject checkbox button
 * @param {HTMLElement} element - The target element
 * @param {string} taskId - Task ID
 * @param {boolean} isCompleted - Current completion status
 */
function injectCheckboxButton(element, taskId, isCompleted) {
  // Check if checkbox already exists
  if (element.querySelector(".extension-checkbox")) {
    return;
  }

  // Find the info icon to insert the checkbox before it
  const infoIcon = element.querySelector(".mb-event__hint-icon");
  if (!infoIcon) {
    console.log("Could not find info icon");
    return;
  }

  // Create checkbox button
  const checkbox = document.createElement("img");
  checkbox.className = "fi fi-info mb-event__hint-icon extension-checkbox";
  checkbox.style.cursor = "pointer";
  checkbox.style.marginRight = "20px";

  // Set checkbox icon based on status
  const updateCheckboxIcon = (completed) => {
    if (completed) {
      // Checked checkbox SVG with larger checkmark - using a data URI
      checkbox.src =
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="green" stroke-width="3"%3E%3Crect x="3" y="3" width="18" height="18" rx="2"/%3E%3Cpath d="M7 12l3 3 7-7"/%3E%3C/svg%3E';
    } else {
      // Empty checkbox SVG
      checkbox.src =
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="2"%3E%3Crect x="3" y="3" width="18" height="18" rx="2"/%3E%3C/svg%3E';
    }
  };

  updateCheckboxIcon(isCompleted);

  // Add click handler
  checkbox.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Toggle status
    const newStatus = !isCompleted;
    console.log(`Toggling task ${taskId} to ${newStatus ? "complete" : "todo"}`);

    // Update checkbox to show loading state
    checkbox.style.opacity = "0.5";

    // Update storage
    const result = newStatus
      ? await markTaskCompleted(taskId)
      : await markTaskTodo(taskId);

    if (result) {
      // Update was successful
      isCompleted = newStatus;
      updateCheckboxIcon(isCompleted);

      // Update dataset status
      element.dataset.taskStatus = isCompleted ? "complete" : "todo";

      // Check if completed tasks should be hidden
      const toggle = document.querySelector(
        ".extension-completed-toggle input",
      );
      if (toggle && toggle.checked && isCompleted) {
        element.style.display = "none";
      }

      console.log(`Task ${taskId} updated to ${isCompleted ? "complete" : "todo"}`);
    } else {
      console.error(`Failed to update task ${taskId}`);
    }

    checkbox.style.opacity = "1";
  });

  // Insert checkbox before the info icon
  infoIcon.parentNode.insertBefore(checkbox, infoIcon);
}

/**
 * Process a single element
 * @param {HTMLElement} element - Element to process
 */
async function processElement(element) {
  // Skip if already processed
  if (element.dataset.extensionProcessed) {
    return;
  }

  // Mark as processed
  element.dataset.extensionProcessed = "true";

  const href = element.getAttribute("href");
  if (!href) {
    return;
  }

  const taskId = extractIdFromHref(href);
  if (!taskId) {
    console.log("Could not extract task ID from href:", href);
    return;
  }

  console.log(`Processing task ${taskId}`);

  // Check if task is completed in storage
  const isCompleted = await isTaskCompleted(taskId);
  const status = isCompleted ? "complete" : "todo";

  console.log(`Task ${taskId} status: ${status}`);

  // Store status in dataset for toggle functionality
  element.dataset.taskStatus = status;

  // Inject checkbox button
  injectCheckboxButton(element, taskId, isCompleted);
}

/**
 * Process all matching elements on the page
 */
async function processAllElements() {
  const elements = document.querySelectorAll(`a.${CONFIG.targetClass}`);
  console.log(`Found ${elements.length} fc-event elements to process`);

  for (const element of elements) {
    await processElement(element);
  }
}

/**
 * Set up MutationObserver for dynamic content
 */
function setupObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node is an <a> with fc-event class
            if (
              node.tagName === "A" &&
              node.classList &&
              node.classList.contains(CONFIG.targetClass)
            ) {
              processElement(node);
            }
            // Check descendants
            const descendants = node.querySelectorAll?.(
              `a.${CONFIG.targetClass}`,
            );
            descendants?.forEach((el) => processElement(el));
          }
        });
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}

/**
 * Create and inject toggle slider for showing/hiding completed tasks
 */
function injectCompletedTasksToggle() {
  // Find the header toolbar
  const toolbar = document.querySelector(".fc-header-toolbar");
  if (!toolbar) {
    console.log("Could not find fc-header-toolbar");
    return;
  }

  // Check if toggle already exists
  if (document.querySelector(".extension-completed-toggle")) {
    return;
  }

  // Create toggle container
  const toggleContainer = document.createElement("div");
  toggleContainer.className = "extension-completed-toggle";
  toggleContainer.style.display = "flex";
  toggleContainer.style.alignItems = "center";
  toggleContainer.style.gap = "8px";

  // Create label
  const label = document.createElement("label");
  label.textContent = "Hide completed";
  label.style.fontSize = "14px";
  label.style.fontWeight = "500";
  label.style.cursor = "pointer";

  // Create toggle switch container
  const switchContainer = document.createElement("label");
  switchContainer.style.position = "relative";
  switchContainer.style.display = "inline-block";
  switchContainer.style.width = "44px";
  switchContainer.style.height = "24px";
  switchContainer.style.cursor = "pointer";

  // Create checkbox input (hidden)
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = false; // Default to showing completed tasks (unchecked = not hiding)
  checkbox.style.opacity = "0";
  checkbox.style.width = "0";
  checkbox.style.height = "0";

  // Create slider
  const slider = document.createElement("span");
  slider.style.position = "absolute";
  slider.style.top = "0";
  slider.style.left = "0";
  slider.style.right = "0";
  slider.style.bottom = "0";
  slider.style.backgroundColor = "#ccc";
  slider.style.borderRadius = "24px";
  slider.style.transition = "0.3s";

  // Create slider knob
  const knob = document.createElement("span");
  knob.style.position = "absolute";
  knob.style.content = "";
  knob.style.height = "18px";
  knob.style.width = "18px";
  knob.style.left = "3px";
  knob.style.bottom = "3px";
  knob.style.backgroundColor = "white";
  knob.style.borderRadius = "50%";
  knob.style.transition = "0.3s";

  slider.appendChild(knob);
  switchContainer.appendChild(checkbox);
  switchContainer.appendChild(slider);

  // Add change event listener
  checkbox.addEventListener("change", () => {
    const hideCompleted = checkbox.checked;

    // Update slider appearance
    if (hideCompleted) {
      slider.style.backgroundColor = "#4a90e2";
      knob.style.transform = "translateX(20px)";
    } else {
      slider.style.backgroundColor = "#ccc";
      knob.style.transform = "translateX(0)";
    }

    // Show/hide completed tasks
    const allTasks = document.querySelectorAll(`a.${CONFIG.targetClass}`);
    allTasks.forEach((task) => {
      const taskId = extractIdFromHref(task.getAttribute("href"));
      if (taskId && task.dataset.taskStatus === "complete") {
        task.style.display = hideCompleted ? "none" : "";
      }
    });

    console.log(`Completed tasks ${hideCompleted ? "hidden" : "shown"}`);
  });

  // Set initial knob position (off/unchecked)
  knob.style.transform = "translateX(0)";

  // Assemble toggle
  toggleContainer.appendChild(label);
  toggleContainer.appendChild(switchContainer);

  // Find all toolbar chunks
  const chunks = toolbar.querySelectorAll(".fc-toolbar-chunk");

  if (chunks.length >= 2) {
    // Insert into the second (middle) chunk which is typically empty
    const middleChunk = chunks[1];
    // Left-justify the toggle within the chunk
    middleChunk.style.display = "flex";
    middleChunk.style.flex = "auto";
    middleChunk.style.paddingLeft = "20px";
    middleChunk.style.justifyContent = "flex-start";
    middleChunk.appendChild(toggleContainer);
    console.log("Completed tasks toggle added to middle toolbar chunk");
  } else {
    // Fallback: append to toolbar
    console.log("Could not find middle chunk, appending to toolbar");
    toolbar.appendChild(toggleContainer);
  }
}

/**
 * Initialize the extension
 */
function initializeExtension() {
  console.log("Initializing ManageBac Tracker Extension");
  if (!location.pathname.includes("/calendar")) {
    console.log("Not a calendar page, skipping initialization");
    return;
  }
  processAllElements();
  setupObserver();
  injectCompletedTasksToggle();
}

/**
 * Set up URL change detection for single-page app navigation
 */
function setupUrlChangeDetection() {
  let lastUrl = location.href;

  // Monitor for URL changes using both popstate and interval checking
  window.addEventListener("popstate", () => {
    if (location.href !== lastUrl) {
      console.log("URL changed via popstate:", location.href);
      lastUrl = location.href;
      // Small delay to let the new content load
      setTimeout(initializeExtension, 500);
    }
  });

  // Also check periodically for URL changes (for pushState navigation)
  const urlCheckInterval = setInterval(() => {
    if (location.href !== lastUrl) {
      console.log("URL changed via navigation:", location.href);
      lastUrl = location.href;
      // Small delay to let the new content load
      setTimeout(initializeExtension, 500);
    }
  }, 1000);

  // Store interval ID for potential cleanup
  return urlCheckInterval;
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initializeExtension();
    setupUrlChangeDetection();
  });
} else {
  initializeExtension();
  setupUrlChangeDetection();
}

console.log("ManageBac Tracker Extension loaded");
