import browser from 'webextension-polyfill';
import type { KeyEvent } from '../types';

const API_URL = 'https://api.typewho.com';

browser.runtime.onMessage.addListener(async (message) => {
  if (message.type === 'TYPING_DATA') {
    try {
      const response = await fetch(`${API_URL}/api/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: message.data })
      });

      const result = await response.json();
      
      if (result.match) {
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Identity Verification',
          message: `User verified with ${(result.confidence * 100).toFixed(1)}% confidence`
        });
      }
    } catch (error) {
      console.error('Error predicting user:', error);
    }
  }
});