import React, { useState, useRef, useMemo } from 'react';
import { Save, Trash2, BarChart2, Keyboard, UserCircle2, Users, Brain, PlayCircle, RotateCcw, AlertTriangle, HelpCircle, Sparkles, X, PieChart, TrendingUp, Shield, UserCheck, Clock, Target, Percent, Home, ChevronRight, Lock, Zap, Fingerprint, Key, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { calculateTypingPattern, comparePatterns } from './lib/typing-analysis';
import { TypingPatternGraph } from './components/TypingPatternGraph';
import type { KeyEvent, TypingPattern, PredictionHistory, UserProfile, UserSession } from './types';

const MINIMUM_SAMPLE_SIZE = 75;
const HIGH_CONFIDENCE_THRESHOLD = 0.85;
const POSSIBLE_MATCH_THRESHOLD = 0.75;
const NO_MATCH_THRESHOLD = 0.6;

const TYPING_TIPS = [
  "💡 Type naturally with your usual rhythm and style",
  "💡 Include punctuation and capitals as you normally would",
  "💡 Write at least a few sentences for better accuracy"
].join('\n');

type Mode = 'create' | 'predict';

export default function App() {
  const [mode, setMode] = useState<Mode>('create');
  const [showDashboard, setShowDashboard] = useState(false);
  const [keyEvents, setKeyEvents] = useState<KeyEvent[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [lastKeyTime, setLastKeyTime] = useState<number | null>(null);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [predictionResult, setPredictionResult] = useState<React.ReactNode | null>(null);
  const [predictionHistory, setPredictionHistory] = useState<PredictionHistory[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [lastKeystrokeTime, setLastKeystrokeTime] = useState<number | null>(null);
  const [typingSpeed, setTypingSpeed] = useState<number>(0);

  const analytics = useMemo(() => {
    const totalPredictions = predictionHistory.length;
    const matchedPredictions = predictionHistory.filter(p => p.confidence >= POSSIBLE_MATCH_THRESHOLD).length;
    const recentPredictions = predictionHistory.slice(-10);
    const recentMatches = recentPredictions.filter(p => p.confidence >= POSSIBLE_MATCH_THRESHOLD).length;
    const errorCount = predictionHistory.filter(p => p.confidence < NO_MATCH_THRESHOLD).length;
    
    return {
      totalAttempts: totalPredictions,
      matchRate: totalPredictions ? (matchedPredictions / totalPredictions) * 100 : 0,
      recentMatchRate: recentPredictions.length ? (recentMatches / recentPredictions.length) * 100 : 0,
      errorRate: totalPredictions ? (errorCount / totalPredictions) * 100 : 0,
      averageConfidence: totalPredictions ? 
        predictionHistory.reduce((acc, curr) => acc + curr.confidence, 0) / totalPredictions * 100 : 0
    };
  }, [predictionHistory]);

  const resetState = () => {
    if (textAreaRef.current) {
      textAreaRef.current.value = '';
    }
    setKeyEvents([]);
    setStartTime(null);
    setLastKeyTime(null);
    setTypingSpeed(0);
    setLastKeystrokeTime(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const now = Date.now();
    if (!startTime) setStartTime(now);

    const keyEvent: KeyEvent = {
      key: e.key,
      code: e.code,
      timestamp: now,
      timeSinceLast: lastKeyTime ? now - lastKeyTime : 0,
      modifiers: {
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey
      }
    };

    if (lastKeystrokeTime) {
      const timeDiff = now - lastKeystrokeTime;
      const instantSpeed = 60000 / timeDiff;
      setTypingSpeed(prev => prev * 0.7 + instantSpeed * 0.3);
    }
    setLastKeystrokeTime(now);
    setLastKeyTime(now);
    setKeyEvents(prev => [...prev, keyEvent]);
  };

  const createNewProfile = () => {
    if (!firstName || !lastName || keyEvents.length < MINIMUM_SAMPLE_SIZE) return;

    const pattern = calculateTypingPattern(keyEvents);
    
    const newProfile: UserProfile = {
      id: Date.now().toString(),
      firstName,
      lastName,
      samples: [keyEvents],
      pattern,
      createdAt: Date.now(),
      role: 'user',
      stats: {
        averageSpeed: pattern.averageSpeed,
        accuracy: 1 - pattern.errorRate,
        totalSamples: 1,
        lastUpdated: Date.now(),
        consistencyScore: 1 - pattern.rhythmConsistency,
        successfulMatches: 0,
        totalAttempts: 0
      }
    };

    setUserProfiles(prev => [...prev, newProfile]);
    setFirstName('');
    setLastName('');
    resetState();
    setMode('predict');
  };

  const predictUser = async () => {
    if (keyEvents.length < MINIMUM_SAMPLE_SIZE) {
      setPredictionResult(
        <div className="text-red-600 text-center">
          Need at least {MINIMUM_SAMPLE_SIZE} keystrokes for accurate prediction
        </div>
      );
      return;
    }

    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const currentPattern = calculateTypingPattern(keyEvents);
    let bestMatch: { profile: UserProfile; similarity: number } | null = null;

    userProfiles.forEach(profile => {
      const similarity = comparePatterns(currentPattern, profile.pattern);
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { profile, similarity: similarity };
      }
    });

    if (bestMatch) {
      const result = `${bestMatch.profile.firstName} ${bestMatch.profile.lastName}`;
      const confidence = bestMatch.similarity;
      const isHighConfidence = confidence >= HIGH_CONFIDENCE_THRESHOLD;
      const isPossibleMatch = confidence >= POSSIBLE_MATCH_THRESHOLD && confidence < HIGH_CONFIDENCE_THRESHOLD;
      const isNoMatch = confidence >= NO_MATCH_THRESHOLD && confidence < POSSIBLE_MATCH_THRESHOLD;
      
      setUserProfiles(prev => prev.map(profile => {
        if (profile.id === bestMatch!.profile.id) {
          const stats = profile.stats;
          stats.totalAttempts++;
          if (isHighConfidence) {
            stats.successfulMatches++;
            const newSamples = [...profile.samples, keyEvents].slice(-5);
            const updatedPattern = calculateTypingPattern(keyEvents);
            return {
              ...profile,
              samples: newSamples,
              pattern: updatedPattern,
              stats: {
                ...stats,
                averageSpeed: (stats.averageSpeed * stats.totalSamples + currentPattern.averageSpeed) / (stats.totalSamples + 1),
                accuracy: (stats.accuracy * stats.totalSamples + (1 - currentPattern.errorRate)) / (stats.totalSamples + 1),
                totalSamples: stats.totalSamples + 1,
                lastUpdated: Date.now(),
                consistencyScore: (stats.consistencyScore * stats.totalSamples + (1 - currentPattern.rhythmConsistency)) / (stats.totalSamples + 1)
              }
            };
          }
          return { ...profile, stats: { ...stats } };
        }
        return profile;
      }));

      if (isHighConfidence) {
        setPredictionResult(
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-white rounded-lg shadow-sm border border-green-200 p-4 max-w-md mx-auto"
          >
            <button 
              onClick={() => setPredictionResult(null)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <UserCheck className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Match Found!</h2>
                <p className="text-xs text-gray-500">High confidence identification</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">User:</span>
                <span className="font-medium text-gray-900">{result}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Confidence:</span>
                <span className="font-medium text-green-600">{(confidence * 100).toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
            </div>
          </motion.div>
        );
      } else if (isPossibleMatch) {
        setPredictionResult(
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-white rounded-lg shadow-sm border border-yellow-200 p-4 max-w-md mx-auto"
          >
            <button 
              onClick={() => setPredictionResult(null)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Possible Match</h2>
                <p className="text-xs text-gray-500">Additional verification recommended</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Possible User:</span>
                <span className="font-medium text-gray-900">{result}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Confidence:</span>
                <span className="font-medium text-yellow-600">{(confidence * 100).toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 rounded-full"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
            </div>
          </motion.div>
        );
      } else {
        setPredictionResult(
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-white rounded-lg shadow-sm border border-red-200 p-4 max-w-md mx-auto"
          >
            <button 
              onClick={() => setPredictionResult(null)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">No Match Found</h2>
                <p className="text-xs text-gray-500">Confidence below threshold</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Confidence:</span>
                <span className="font-medium text-red-600">{(confidence * 100).toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 rounded-full"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
            </div>
          </motion.div>
        );
      }

      setPredictionHistory(prev => [...prev, {
        predictedUser: result,
        confidence: confidence,
        correct: isHighConfidence,
        timestamp: Date.now()
      }]);
    }

    setIsGenerating(false);
    resetState();
  };

  const deleteProfile = (id: string) => {
    setUserProfiles(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto">
          <div className="h-16 grid grid-cols-3 items-center px-4">
            <div className="flex items-center gap-2">
              <Keyboard className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">
                TypeWho?
              </h1>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setShowDashboard(!showDashboard)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  showDashboard 
                    ? 'bg-indigo-600 text-white shadow-lg scale-105' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <BarChart2 size={20} />
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowHowItWorks(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                <HelpCircle size={20} />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showDashboard && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-gray-200 overflow-hidden"
              >
                <div className="p-4">
                  <div className="grid grid-cols-4 gap-4">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-5 h-5 text-indigo-600" />
                        <h3 className="font-medium">Total Attempts</h3>
                      </div>
                      <p className="text-2xl font-bold">{analytics.totalAttempts}</p>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <UserCheck className="w-5 h-5 text-green-600" />
                        <h3 className="font-medium">Match Rate</h3>
                      </div>
                      <p className="text-2xl font-bold">{analytics.matchRate.toFixed(1)}%</p>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <h3 className="font-medium">Error Rate</h3>
                      </div>
                      <p className="text-2xl font-bold">{analytics.errorRate.toFixed(1)}%</p>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Percent className="w-5 h-5 text-purple-600" />
                        <h3 className="font-medium">Avg. Confidence</h3>
                      </div>
                      <p className="text-2xl font-bold">{analytics.averageConfidence.toFixed(1)}%</p>
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mt-4 bg-white p-6 rounded-xl shadow-sm border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                        <h3 className="text-lg font-semibold">Error Analysis</h3>
                      </div>
                      <span className="text-sm text-gray-500">
                        Last {Math.min(5, predictionHistory.filter(p => p.confidence < NO_MATCH_THRESHOLD).length)} errors
                      </span>
                    </div>
                    <div className="space-y-4">
                      {predictionHistory
                        .filter(p => p.confidence < NO_MATCH_THRESHOLD)
                        .slice(-5)
                        .reverse()
                        .map((prediction, index) => (
                          <div key={index} className="bg-gray-50 p-3 rounded-lg">
                            <div className="flex justify-between items-center">
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Attempted Match</span>
                                <span className="text-gray-400 ml-2">
                                  {new Date(prediction.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <span className="text-red-600 font-medium">
                                {(prediction.confidence * 100).toFixed(1)}% confidence
                              </span>
                            </div>
                          </div>
                        ))}
                      {predictionHistory.filter(p => p.confidence < NO_MATCH_THRESHOLD).length === 0 && (
                        <div className="text-center text-gray-500 py-4">
                          No errors recorded yet
                        </div>
                      )}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mt-4 bg-white p-6 rounded-xl shadow-sm border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <Users className="w-6 h-6 text-indigo-600" />
                        </div>
                        <h3 className="text-lg font-semibold">User Profiles</h3>
                      </div>
                      <span className="text-sm text-gray-500">{userProfiles.length} profiles</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {userProfiles.map(profile => (
                        <motion.div
                          key={profile.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-gray-50 p-4 rounded-lg border border-gray-100"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium">{profile.firstName} {profile.lastName}</h3>
                                {profile.role === 'admin' && (
                                  <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded-full">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{new Date(profile.createdAt).toLocaleDateString()}</p>
                            </div>
                            <button
                              onClick={() => deleteProfile(profile.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-500">Success Rate:</span>
                                <span className="ml-1 font-medium">
                                  {profile.stats.totalAttempts > 0
                                    ? ((profile.stats.successfulMatches / profile.stats.totalAttempts) * 100).toFixed(1)
                                    : '0'}%
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">Accuracy:</span>
                                <span className="ml-1 font-medium">
                                  {(profile.stats.accuracy * 100).toFixed(1)}%
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">Samples:</span>
                                <span className="ml-1 font-medium">{profile.stats.totalSamples}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Consistency:</span>
                                <span className="ml-1 font-medium">
                                  {(profile.stats.consistencyScore * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="mt-4 bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-xl text-white"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg">
                          <Zap className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-semibold">Recent System Performance</h3>
                      </div>
                      <div className="flex items-center gap-2 text-white/80 text-sm">
                        <Clock size={16} />
                        <span>Last 10 predictions</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-white/80">
                          <Fingerprint size={16} />
                          <span>Recent Accuracy</span>
                        </div>
                        <p className="text-3xl font-bold">{analytics.recentMatchRate.toFixed(1)}%</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-white/80">
                          <Key size={16} />
                          <span>Active Profiles</span>
                        </div>
                        <p className="text-3xl font-bold">{userProfiles.length}</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-white/80">
                          <Cpu size={16} />
                          <span>System Load</span>
                        </div>
                        <p className="text-3xl font-bold">Optimal</p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 gap-6 mb-8">
          <button
            onClick={() => setMode('create')}
            className={`p-6 rounded-xl transition-all ${
              mode === 'create'
                ? 'bg-indigo-600 text-white shadow-lg scale-105'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            } border border-gray-200`}
          >
            <div className="flex items-center gap-3 mb-3">
              <UserCircle2 className={`w-8 h-8 ${mode === 'create' ? 'text-white' : 'text-indigo-600'}`} />
              <h2 className="text-xl font-bold">Create Profile</h2>
            </div>
            <p className={mode === 'create' ? 'text-indigo-100' : 'text-gray-500'}>
              Create a new typing profile to be identified later
            </p>
          </button>

          <button
            onClick={() => setMode('predict')}
            disabled={userProfiles.length === 0}
            className={`p-6 rounded-xl transition-all ${
              mode === 'predict'
                ? 'bg-purple-600 text-white shadow-lg scale-105'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            } border border-gray-200 ${userProfiles.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-3 mb-3">
              <UserCircle2 className={`w-8 h-8 ${mode === 'predict' ? 'text-white' : 'text-purple-600'}`} />
              <h2 className="text-xl font-bold">Predict User</h2>
            </div>
            <p className={mode === 'predict' ? 'text-purple-100' : 'text-gray-500'}>
              {userProfiles.length === 0
                ? 'Create a profile first to enable prediction'
                : 'Identify yourself based on your typing pattern'}
            </p>
          </button>
        </div>

        {predictionResult && (
          <div className="mb-6">
            {predictionResult}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="space-y-4">
            {mode === 'create' && (
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="px-4 py-2 border rounded-lg rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium text-gray-700">Type something...</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {keyEvents.length} / {MINIMUM_SAMPLE_SIZE} keystrokes
                  </span>
                  {typingSpeed > 0 && (
                    <span className="text-sm text-gray-500">
                      ({Math.round(typingSpeed)} WPM)
                    </span>
                  )}
                </div>
              </div>
              <textarea
                ref={textAreaRef}
                onKeyDown={handleKeyDown}
                placeholder={TYPING_TIPS}
                className="w-full h-32 p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
              />
              {keyEvents.length > 0 && (
                <div className="mt-4">
                  <TypingPatternGraph keyEvents={keyEvents} />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={resetState}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                <div className="flex items-center gap-2">
                  <RotateCcw size={16} />
                  <span>Reset</span>
                </div>
              </button>
              {mode === 'create' ? (
                <button
                  onClick={createNewProfile}
                  disabled={!firstName || !lastName || keyEvents.length < MINIMUM_SAMPLE_SIZE}
                  className={`px-6 py-2 rounded-lg bg-indigo-600 text-white flex items-center gap-2
                    ${(!firstName || !lastName || keyEvents.length < MINIMUM_SAMPLE_SIZE)
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-indigo-700'}`}
                >
                  <Save size={16} />
                  <span>Save Profile</span>
                </button>
              ) : (
                <button
                  onClick={predictUser}
                  disabled={keyEvents.length < MINIMUM_SAMPLE_SIZE || isGenerating}
                  className={`px-6 py-2 rounded-lg bg-purple-600 text-white flex items-center gap-2
                    ${(keyEvents.length < MINIMUM_SAMPLE_SIZE || isGenerating)
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-purple-700'}`}
                >
                  {isGenerating ? (
                    <>
                      <Sparkles size={16} className="animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <PlayCircle size={16} />
                      <span>Predict</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showHowItWorks && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <Brain className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h2 className="text-xl font-bold">How It Works</h2>
                  </div>
                  <button
                    onClick={() => setShowHowItWorks(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mt-1">
                      <Fingerprint className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Biometric Analysis</h3>
                      <p className="text-gray-600">
                        TypeWho analyzes your unique typing patterns, including rhythm, speed variations, and common key combinations to create a digital fingerprint of your typing style.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mt-1">
                      <Brain className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Machine Learning</h3>
                      <p className="text-gray-600">
                        Advanced pattern recognition algorithms learn and adapt to your typing behavior over time, improving accuracy with each use.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mt-1">
                      <Shield className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Privacy First</h3>
                      <p className="text-gray-600">
                        Your typing data is analyzed locally and never leaves your device. Profiles are stored securely and can be deleted at any time.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mt-1">
                      <TrendingUp className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Continuous Improvement</h3>
                      <p className="text-gray-600">
                        The system learns from each interaction, becoming more accurate at identifying users over time.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mt-6">
                  <h4 className="font-medium text-gray-900 mb-4">Confidence Levels Explained</h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <UserCheck className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <h5 className="font-medium text-green-900">High Confidence (≥85%)</h5>
                        <p className="text-sm text-green-700">Strong match with the user's typing pattern</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                      <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      </div>
                      <div>
                        <h5 className="font-medium text-yellow-900">Possible Match (75-84%)</h5>
                        <p className="text-sm text-yellow-700">Additional verification recommended</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      </div>
                      <div>
                        <h5 className="font-medium text-red-900">No Match (≤74%)</h5>
                        <p className="text-sm text-red-700">Insufficient confidence for identification</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mt-6">
                  <h4 className="font-medium text-gray-900 mb-2">Tips for Best Results</h4>
                  <ul className="space-y-2 text-gray-600">
                    <li className="flex items-center gap-2">
                      <ChevronRight size={16} className="text-gray-400" />
                      Type naturally and maintain your usual rhythm
                    </li>
                    <li className="flex items-center gap-2">
                      <ChevronRight size={16} className="text-gray-400" />
                      Include punctuation and capitals as you normally would
                    </li>
                    <li className="flex items-center gap-2">
                      <ChevronRight size={16} className="text-gray-400" />
                      Write at least a few sentences for better accuracy
                    </li>
                    <li className="flex items-center gap-2">
                      <ChevronRight size={16} className="text-gray-400" />
                      Create multiple profiles in different typing conditions
                    </li>
                  </ul>
                </div>
              </div>

              <div className="p-6 bg-gray-50 rounded-b-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Lock size={16} />
                    <span className="text-sm">Your privacy is our priority</span>
                  </div>
                  <button
                    onClick={() => setShowHowItWorks(false)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}