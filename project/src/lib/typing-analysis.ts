import type { KeyEvent, TypingPattern } from '../types';

export function calculateTypingPattern(events: KeyEvent[]): TypingPattern {
  const pattern: TypingPattern = {
    averageSpeed: 0,
    keyPressDistribution: {},
    modifierUsage: {},
    timingPatterns: [],
    specialKeyFrequency: {},
    backspaceFrequency: 0,
    averageWordLength: 0,
    rhythmConsistency: 0,
    modifierFrequency: 0,
    capitalFrequency: 0,
    punctuationFrequency: 0,
    burstSpeed: 0,
    pauseFrequency: 0,
    speedVariability: 0,
    keyPressForce: 0,
    errorRate: 0
  };

  if (events.length < 2) return pattern;

  // Calculate timing patterns and average speed
  const intervals = events.slice(1).map((event, i) => event.timeSinceLast);
  pattern.timingPatterns = intervals;
  
  // Use trimmed mean for more stable speed calculation
  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  const trimAmount = Math.floor(sortedIntervals.length * 0.1); // Trim 10% from each end
  const trimmedIntervals = sortedIntervals.slice(trimAmount, -trimAmount);
  pattern.averageSpeed = trimmedIntervals.reduce((a, b) => a + b, 0) / trimmedIntervals.length;

  // Calculate rhythm consistency using normalized standard deviation
  const mean = pattern.averageSpeed;
  const variance = intervals.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intervals.length;
  pattern.rhythmConsistency = Math.sqrt(variance) / mean; // Coefficient of variation

  // Calculate speed variability using quartiles for robustness
  const q1 = sortedIntervals[Math.floor(sortedIntervals.length * 0.25)];
  const q3 = sortedIntervals[Math.floor(sortedIntervals.length * 0.75)];
  pattern.speedVariability = (q3 - q1) / pattern.averageSpeed;

  // Calculate pause frequency with adaptive threshold
  const pauseThreshold = pattern.averageSpeed * 2;
  pattern.pauseFrequency = intervals.filter(i => i > pauseThreshold).length / intervals.length;

  // Calculate burst speed using dynamic window
  const windowSize = Math.max(5, Math.floor(intervals.length * 0.2));
  let minBurst = Infinity;
  for (let i = 0; i <= intervals.length - windowSize; i++) {
    const windowAvg = intervals.slice(i, i + windowSize).reduce((a, b) => a + b, 0) / windowSize;
    minBurst = Math.min(minBurst, windowAvg);
  }
  pattern.burstSpeed = minBurst;

  let wordBuffer = '';
  let wordLengths: number[] = [];
  let modifierCount = 0;
  let capitalCount = 0;
  let punctuationCount = 0;
  let backspaceCount = 0;
  let totalChars = 0;
  let keyDistribution: { [key: string]: number } = {};

  events.forEach(event => {
    // Track modifier key usage with timing context
    if (Object.values(event.modifiers).some(v => v)) {
      modifierCount++;
      const timing = event.timeSinceLast;
      if (timing > 0) {
        pattern.modifierUsage[event.key] = timing;
      }
    }

    if (event.key.length === 1) {
      totalChars++;
      keyDistribution[event.key] = (keyDistribution[event.key] || 0) + 1;
      
      if (event.key.match(/[A-Z]/)) {
        capitalCount++;
      }

      if (event.key.match(/[.,!?;:'"]/)) {
        punctuationCount++;
      }

      if (event.key === ' ' || event.key === 'Enter') {
        if (wordBuffer.length > 0) {
          wordLengths.push(wordBuffer.length);
          wordBuffer = '';
        }
      } else {
        wordBuffer += event.key;
      }
    }

    if (event.key === 'Backspace') {
      backspaceCount++;
      if (wordBuffer.length > 0) {
        wordBuffer = wordBuffer.slice(0, -1);
      }
    }
  });

  // Finalize word buffer
  if (wordBuffer.length > 0) {
    wordLengths.push(wordBuffer.length);
  }

  // Calculate normalized key distribution with Laplace smoothing
  const totalKeyPresses = Object.values(keyDistribution).reduce((a, b) => a + b, 0);
  const alpha = 0.1; // Smoothing parameter
  const vocabSize = Object.keys(keyDistribution).length;
  pattern.keyPressDistribution = Object.fromEntries(
    Object.entries(keyDistribution).map(([key, count]) => [
      key,
      (count + alpha) / (totalKeyPresses + alpha * vocabSize)
    ])
  );

  // Calculate error rate with context-aware normalization
  const normalizedBackspaceRate = backspaceCount / (totalChars + backspaceCount);
  pattern.errorRate = normalizedBackspaceRate * (1 + pattern.speedVariability);

  // Calculate average word length using trimmed mean
  if (wordLengths.length > 0) {
    wordLengths.sort((a, b) => a - b);
    const trimCount = Math.floor(wordLengths.length * 0.1);
    const trimmedLengths = wordLengths.slice(trimCount, -trimCount || undefined);
    pattern.averageWordLength = trimmedLengths.reduce((a, b) => a + b, 0) / trimmedLengths.length;
  }

  pattern.modifierFrequency = events.length > 0 ? modifierCount / events.length : 0;
  pattern.capitalFrequency = totalChars > 0 ? capitalCount / totalChars : 0;
  pattern.punctuationFrequency = totalChars > 0 ? punctuationCount / totalChars : 0;
  pattern.backspaceFrequency = totalChars > 0 ? backspaceCount / totalChars : 0;

  return pattern;
}

export function comparePatterns(pattern1: TypingPattern, pattern2: TypingPattern): number {
  // Adaptive weights based on pattern stability
  const getWeight = (metric1: number, metric2: number, baseWeight: number) => {
    const stability = 1 - Math.abs(metric1 - metric2) / Math.max(metric1, metric2, 1);
    return baseWeight * (0.5 + 0.5 * stability); // Weight varies between 50-100% of base weight
  };

  const baseWeights = {
    speed: 0.3,
    keyDistribution: 0.25,
    rhythm: 0.2,
    timing: 0.15,
    style: 0.1
  };

  // Speed comparison with adaptive tolerance
  const speedRatio = Math.min(pattern1.averageSpeed, pattern2.averageSpeed) / 
                    Math.max(pattern1.averageSpeed, pattern2.averageSpeed);
  const speedWeight = getWeight(pattern1.averageSpeed, pattern2.averageSpeed, baseWeights.speed);
  const speedSimilarity = Math.pow(speedRatio, 0.5); // More forgiving speed comparison

  // Key distribution comparison with context
  const allKeys = new Set([
    ...Object.keys(pattern1.keyPressDistribution),
    ...Object.keys(pattern2.keyPressDistribution)
  ]);
  
  let keyDistSimilarity = 0;
  let keyDistTotalWeight = 0;
  
  allKeys.forEach(key => {
    const freq1 = pattern1.keyPressDistribution[key] || 0;
    const freq2 = pattern2.keyPressDistribution[key] || 0;
    
    if (freq1 > 0 || freq2 > 0) {
      const keyWeight = Math.max(freq1, freq2); // Weight by key importance
      const similarity = 1 - Math.abs(freq1 - freq2) / Math.max(freq1, freq2, 0.01);
      keyDistSimilarity += similarity * keyWeight;
      keyDistTotalWeight += keyWeight;
    }
  });
  
  keyDistSimilarity = keyDistTotalWeight > 0 ? keyDistSimilarity / keyDistTotalWeight : 0;
  const keyDistWeight = getWeight(
    Object.keys(pattern1.keyPressDistribution).length,
    Object.keys(pattern2.keyPressDistribution).length,
    baseWeights.keyDistribution
  );

  // Rhythm comparison with tolerance for natural variation
  const rhythmSimilarity = Math.exp(-Math.abs(pattern1.rhythmConsistency - pattern2.rhythmConsistency));
  const rhythmWeight = getWeight(pattern1.rhythmConsistency, pattern2.rhythmConsistency, baseWeights.rhythm);

  // Timing patterns comparison with context
  const burstSpeedSimilarity = Math.min(pattern1.burstSpeed, pattern2.burstSpeed) / 
                              Math.max(pattern1.burstSpeed, pattern2.burstSpeed);
  const pauseSimilarity = 1 - Math.abs(pattern1.pauseFrequency - pattern2.pauseFrequency);
  const timingSimilarity = (burstSpeedSimilarity * 0.6 + pauseSimilarity * 0.4);
  const timingWeight = getWeight(pattern1.pauseFrequency, pattern2.pauseFrequency, baseWeights.timing);

  // Style comparison with weighted components
  const modifierSimilarity = 1 - Math.abs(pattern1.modifierFrequency - pattern2.modifierFrequency);
  const capitalSimilarity = 1 - Math.abs(pattern1.capitalFrequency - pattern2.capitalFrequency);
  const punctuationSimilarity = 1 - Math.abs(pattern1.punctuationFrequency - pattern2.punctuationFrequency);
  const styleSimilarity = (
    modifierSimilarity * 0.4 +
    capitalSimilarity * 0.3 +
    punctuationSimilarity * 0.3
  );
  const styleWeight = getWeight(
    pattern1.modifierFrequency + pattern1.capitalFrequency,
    pattern2.modifierFrequency + pattern2.capitalFrequency,
    baseWeights.style
  );

  // Calculate final similarity score with adaptive weights
  const finalTotalWeight = speedWeight + keyDistWeight + rhythmWeight + timingWeight + styleWeight;
  const similarity = (
    speedSimilarity * speedWeight +
    keyDistSimilarity * keyDistWeight +
    rhythmSimilarity * rhythmWeight +
    timingSimilarity * timingWeight +
    styleSimilarity * styleWeight
  ) / finalTotalWeight;

  // Apply confidence adjustment based on sample quality
  const confidenceMultiplier = Math.min(
    1,
    Math.sqrt(Object.keys(pattern1.keyPressDistribution).length / 20) * // Key variety
    Math.sqrt(Object.keys(pattern2.keyPressDistribution).length / 20) *
    (1 - Math.abs(pattern1.errorRate - pattern2.errorRate)) // Error rate consistency
  );

  return similarity * confidenceMultiplier;
}