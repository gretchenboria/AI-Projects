import express from 'express';
import cors from 'cors';
import { calculateTypingPattern, comparePatterns } from '../lib/typing-analysis';
import type { KeyEvent, TypingPattern } from '../types';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory storage (replace with a proper database in production)
const profiles = new Map<string, TypingPattern>();

app.post('/api/analyze', (req, res) => {
  const events: KeyEvent[] = req.body.events;
  if (!Array.isArray(events) || events.length < 75) {
    return res.status(400).json({ error: 'Invalid or insufficient typing data' });
  }

  const pattern = calculateTypingPattern(events);
  res.json({ pattern });
});

app.post('/api/predict', (req, res) => {
  const events: KeyEvent[] = req.body.events;
  if (!Array.isArray(events) || events.length < 75) {
    return res.status(400).json({ error: 'Invalid or insufficient typing data' });
  }

  const currentPattern = calculateTypingPattern(events);
  let bestMatch = { userId: '', similarity: 0 };

  profiles.forEach((pattern, userId) => {
    const similarity = comparePatterns(currentPattern, pattern);
    if (similarity > bestMatch.similarity) {
      bestMatch = { userId, similarity };
    }
  });

  res.json({
    match: bestMatch.similarity > 0.7 ? bestMatch.userId : null,
    confidence: bestMatch.similarity
  });
});

app.listen(port, () => {
  console.log(`TypeWho API running on port ${port}`);
});