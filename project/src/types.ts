export interface KeyEvent {
  key: string;
  code: string;
  timestamp: number;
  timeSinceLast: number;
  modifiers: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
  };
}

export interface TypingPattern {
  averageSpeed: number;
  keyPressDistribution: { [key: string]: number };
  modifierUsage: { [key: string]: number };
  timingPatterns: number[];
  specialKeyFrequency: { [key: string]: number };
  backspaceFrequency: number;
  averageWordLength: number;
  rhythmConsistency: number;
  modifierFrequency: number;
  capitalFrequency: number;
  punctuationFrequency: number;
  burstSpeed: number;
  pauseFrequency: number;
  speedVariability: number;
  keyPressForce: number;
  errorRate: number;
}

export interface PredictionHistory {
  timestamp: number;
  predictedUser: string;
  confidence: number;
  correct: boolean;
}

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  samples: KeyEvent[][];
  pattern: TypingPattern;
  createdAt: number;
  role: 'admin' | 'user';
  stats: {
    averageSpeed: number;
    accuracy: number;
    totalSamples: number;
    lastUpdated: number;
    consistencyScore: number;
    successfulMatches: number;
    totalAttempts: number;
  };
}

export interface UserSession {
  isAdmin: boolean;
  profile?: UserProfile;
}