/**
 * Chrome Extension Background Service Worker
 * Handles background tasks and extension lifecycle events
 */

export {}

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Initialize default settings
    chrome.storage.local.set({
      "ace-ielts-language": "en",
      "ace-ielts-initialized": true
    })
  }
  // Update handling can be added here if needed
})

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OPEN_DASHBOARD") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("tabs/dashboard.html")
    })
    sendResponse({ success: true })
  }
  return true
})
