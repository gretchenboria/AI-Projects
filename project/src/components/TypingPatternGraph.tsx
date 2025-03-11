import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { KeyEvent } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Props {
  keyEvents: KeyEvent[];
  height?: number;
}

export function TypingPatternGraph({ keyEvents, height = 100 }: Props) {
  const intervals = keyEvents.slice(1).map(event => event.timeSinceLast);
  const movingAverage = intervals.map((_, i) => {
    const window = intervals.slice(Math.max(0, i - 5), i + 1);
    return window.reduce((a, b) => a + b, 0) / window.length;
  });

  const data = {
    labels: Array(movingAverage.length).fill(''),
    datasets: [
      {
        label: 'Typing Pattern',
        data: movingAverage,
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
    },
    scales: {
      x: {
        display: false,
      },
      y: {
        display: false,
        min: 0,
        suggestedMax: Math.max(...movingAverage) * 1.2,
      },
    },
    animation: {
      duration: 0,
    },
  };

  return (
    <div style={{ height: `${height}px` }}>
      <Line data={data} options={options} />
    </div>
  );
}