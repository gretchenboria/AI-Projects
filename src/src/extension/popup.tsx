import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';

function Popup() {
  const [status, setStatus] = useState('active');
  const [predictions, setPredictions] = useState<Array<{
    timestamp: number;
    confidence: number;
    user: string;
  }>>([]);

  useEffect(() => {
    // Load predictions from storage
    chrome.storage.local.get(['predictions'], (result) => {
      if (result.predictions) {
        setPredictions(result.predictions);
      }
    });
  }, []);

  return (
    <div className="w-80 p-4 bg-white">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 rounded-full bg-green-500"></div>
        <h1 className="text-lg font-semibold">TypeWho is {status}</h1>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <h2 className="text-sm font-medium text-gray-700 mb-2">Recent Predictions</h2>
          {predictions.length > 0 ? (
            <div className="space-y-2">
              {predictions.slice(0, 5).map((pred, i) => (
                <div key={i} className="text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{pred.user}</span>
                    <span className="text-gray-500">{(pred.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(pred.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No predictions yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />);