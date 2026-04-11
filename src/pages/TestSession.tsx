import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Clock, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { collection, addDoc, query, where, getDocs, setDoc, doc, deleteDoc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useProctoring } from '@/src/hooks/useProctoring';
import { ModuleId, Question, ProctoringEvent, LiveSession, SystemSettings, Test } from '@/src/types';
import { cn } from '@/src/lib/utils';
import ProctoringOverlay from '@/src/components/ProctoringOverlay';
import { useAuth } from '@/src/context/AuthContext';
import { useSettings } from '@/src/context/SettingsContext';
import { db, handleFirestoreError, OperationType } from '@/src/firebase';

import { MOCK_QUESTIONS } from '@/src/constants/questions';
import { generateAIQuestions } from '@/src/services/aiQuestionService';

export default function TestSession() {
  const { moduleId } = useParams<{ moduleId: ModuleId }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { settings } = useSettings();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [proctoringEvents, setProctoringEvents] = useState<ProctoringEvent[]>([]);
  const [showWarning, setShowWarning] = useState(false);
  const [lastViolation, setLastViolation] = useState<ProctoringEvent | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));

  const calculateScore = useCallback(() => {
    let score = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correctAnswer) {
        score++;
      }
    });
    return score;
  }, [questions, answers]);

  const saveResults = useCallback(async (reason?: string) => {
    if (!profile || isSaving) return;
    setIsSaving(true);
    const score = calculateScore();
    
    try {
      await addDoc(collection(db, 'results'), {
        userId: profile.uid,
        moduleId,
        score,
        totalQuestions: questions.length,
        completedAt: new Date().toISOString(),
        proctoringEvents: proctoringEvents,
        questionIds: questions.map(q => q.id),
        submissionReason: reason || 'normal'
      });

      // Delete live session on completion
      await deleteDoc(doc(db, 'live_sessions', profile.uid));

      setIsFinished(true);
      // Exit fullscreen on finish
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.error(err));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'results');
    } finally {
      setIsSaving(false);
    }
  }, [profile, isSaving, questions, answers, proctoringEvents, moduleId, calculateScore]);

  const handleViolation = useCallback((event: ProctoringEvent) => {
    setProctoringEvents(prev => [...prev, event]);
    setLastViolation(event);
    setShowWarning(true);
    
    // Auto-submit on specific immediate violations
    if (settings) {
      if (event.type === 'face_missing_timeout') {
        saveResults(event.type);
      }
      
      const tabSwitches = proctoringEvents.filter(e => e.type === 'tab_switch').length + (event.type === 'tab_switch' ? 1 : 0);
      if (event.type === 'tab_switch' && tabSwitches >= (settings.proctoring.maxTabSwitches || 3)) {
        saveResults('max_tab_switches_exceeded');
      }
    } else {
      // Fallback if settings not loaded
      if (event.type === 'tab_switch' || event.type === 'face_missing_timeout') {
        saveResults(event.type);
      }
    }

    setTimeout(() => setShowWarning(false), 5000);
  }, [saveResults, settings, proctoringEvents]);

  const { videoRef, isFaceDetected } = useProctoring({
    onViolation: handleViolation,
    enabled: !isFinished && hasStarted,
    settings: settings?.proctoring
  });

  // Live Session Heartbeat
  useEffect(() => {
    if (!profile || !moduleId || isFinished || questions.length === 0) return;

    const sessionRef = doc(db, 'live_sessions', profile.uid);
    
    const updateSession = async () => {
      try {
        const score = calculateScore();
        const proctoringStatus = proctoringEvents.length > 5 ? 'critical' : proctoringEvents.length > 2 ? 'warning' : 'safe';
        
        await setDoc(sessionRef, {
          id: profile.uid,
          userId: profile.uid,
          userEmail: profile.email,
          displayName: profile.displayName,
          moduleId,
          startTime: new Date().toISOString(), // This should ideally be set once
          lastHeartbeat: new Date().toISOString(),
          currentQuestionIndex,
          totalQuestions: questions.length,
          score,
          proctoringStatus,
          isFaceDetected,
          violationCount: proctoringEvents.length,
          latestViolation: proctoringEvents.length > 0 ? proctoringEvents[proctoringEvents.length - 1] : null
        }, { merge: true });
      } catch (err) {
        console.error("Error updating live session:", err);
      }
    };

    // Initial update
    updateSession();

    // Heartbeat every 5 seconds
    const interval = setInterval(updateSession, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, [profile, moduleId, isFinished, questions, currentQuestionIndex, proctoringEvents, isFaceDetected, calculateScore]);

  // Remote Command Listener
  useEffect(() => {
    if (!profile || isFinished) return;

    const sessionRef = doc(db, 'live_sessions', profile.uid);
    const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as LiveSession;
        if (data.remoteCommand === 'submit') {
          saveResults('remote_submit');
        } else if (data.remoteCommand === 'cancel') {
          // Just navigate away and delete session
          deleteDoc(sessionRef).then(() => {
            navigate('/dashboard');
          });
        }
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'live_sessions'));

    return () => unsubscribe();
  }, [profile, isFinished, saveResults, navigate]);

  // Fetch and filter questions from Firestore
  useEffect(() => {
    if (!profile || !moduleId) return;

    // Listen to tests in real-time
    const testsQuery = query(collection(db, 'tests'), where('moduleId', '==', moduleId));
    
    const unsubscribe = onSnapshot(testsQuery, async (snapshot) => {
      setIsLoadingQuestions(true);
      try {
        // Get already answered questions from results
        const resultsQuery = query(
          collection(db, 'results'),
          where('userId', '==', profile.uid),
          where('moduleId', '==', moduleId)
        );
        const resultsSnapshot = await getDocs(resultsQuery);
        const answeredIds = new Set<string>();
        resultsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.questionIds) {
            data.questionIds.forEach((id: string) => answeredIds.add(id));
          }
        });

        // Combine questions from all tests in this module
        const allTests = snapshot.docs.map(doc => doc.data() as Test);
        const pool = allTests.flatMap(t => t.questions || []);
        
        // Filter out already answered questions
        const available = pool.filter(q => !answeredIds.has(q.id));

        if (available.length < 3) {
          // If pool is low, generate more using AI or use mock fallback
          console.log("Pool low, using mock/AI fallback...");
          const mockPool = MOCK_QUESTIONS[moduleId] || [];
          const availableMock = mockPool.filter(q => !answeredIds.has(q.id));
          
          const combined = [...available, ...availableMock];
          const shuffled = combined.sort(() => Math.random() - 0.5);
          setQuestions(shuffled.slice(0, 3));
        } else {
          // Shuffle and pick 3
          const shuffled = [...available].sort(() => Math.random() - 0.5);
          setQuestions(shuffled.slice(0, 3));
        }
      } catch (err) {
        console.error("Error fetching questions:", err);
        // Fallback to mock questions if everything fails
        const mockPool = MOCK_QUESTIONS[moduleId] || [];
        setQuestions(mockPool.slice(0, 3));
      } finally {
        setIsLoadingQuestions(false);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'tests');
      setIsLoadingQuestions(false);
    });

    return () => unsubscribe();
  }, [profile, moduleId]);

  const currentQuestion = questions[currentQuestionIndex];

  // Monitor violations for auto-submit
  useEffect(() => {
    if (isFinished) return;
    
    const faceViolations = proctoringEvents.filter(e => e.type === 'face_missing').length;
    if (faceViolations > 5) {
      saveResults('face_missing_violations');
    }
  }, [proctoringEvents, isFinished, saveResults]);

  // Fullscreen and Tab Switching logic
  useEffect(() => {
    // Prevent exiting fullscreen
    const handleFullScreenChange = () => {
      if (!document.fullscreenElement && !isFinished && hasStarted) {
        handleViolation({
          timestamp: Date.now(),
          type: 'tab_switch',
          details: 'Exited full screen mode. Auto-submitting test.'
        });
      }
    };

    // Tab switching detection (additional layer)
    const handleVisibilityChange = () => {
      if (document.hidden && !isFinished && hasStarted) {
        handleViolation({
          timestamp: Date.now(),
          type: 'tab_switch',
          details: 'Tab switched or window minimized. Auto-submitting test.'
        });
      }
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isFinished, handleViolation]);

  // Timer logic
  useEffect(() => {
    if (isFinished || !hasStarted) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          saveResults();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isFinished, saveResults]);

  const handleAnswer = (optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: optionIndex }));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoadingQuestions) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-900 font-bold text-xl mb-2">AI Guardian is preparing your test...</p>
          <p className="text-gray-500">Generating unique, challenging questions just for you.</p>
        </div>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center border border-gray-100"
        >
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-6">
            <Shield size={40} />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Ready to Start?</h2>
          <p className="text-gray-500 mb-8">
            This test is proctored by AI. You must remain in full-screen mode and keep your face visible at all times.
          </p>
          
          <div className="bg-amber-50 rounded-2xl p-4 mb-8 text-left">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Rules:</p>
            <ul className="text-xs text-amber-700 space-y-1 list-disc ml-4">
              <li>Do not switch tabs or minimize the window.</li>
              <li>Ensure you are in a well-lit environment.</li>
              <li>Only one person should be visible in the camera.</li>
              <li>Test will auto-submit on major violations.</li>
            </ul>
          </div>

          <button
            onClick={async () => {
              try {
                if (document.documentElement.requestFullscreen) {
                  await document.documentElement.requestFullscreen();
                }
              } catch (err) {
                console.error("Fullscreen failed:", err);
              }
              setHasStarted(true);
            }}
            className="w-full bg-primary text-white py-4 rounded-2xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/10"
          >
            Start Test Now
          </button>
        </motion.div>
      </div>
    );
  }

  if (isFinished) {
    const score = calculateScore();
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center border border-gray-100"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Test Completed!</h2>
          <p className="text-gray-500 mb-8">Your results have been processed and proctored.</p>
          
          <div className="bg-gray-50 rounded-3xl p-6 mb-8 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Score</p>
              <p className="text-3xl font-bold text-gray-900">{score} / {questions.length}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Violations</p>
              <p className={cn("text-3xl font-bold", proctoringEvents.length > 0 ? "text-red-500" : "text-emerald-500")}>
                {proctoringEvents.length}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-primary text-white py-4 rounded-2xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/10"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => navigate(`/analysis/${moduleId}`)}
              className="w-full bg-white text-gray-700 border border-gray-200 py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all"
            >
              View Detailed Analysis
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Sidebar - Proctoring View */}
      <aside className="w-full lg:w-80 bg-white border-r border-gray-200 p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
              <Shield size={18} />
            </div>
            <span className="text-lg font-bold">{settings?.branding?.siteName || 'ProctorLearn AI'}</span>
          </div>
          <button 
            onClick={saveResults}
            disabled={isSaving}
            className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {isSaving ? 'Submitting...' : 'Finish Test'}
          </button>
        </div>

        <ProctoringOverlay
          videoRef={videoRef}
          isFaceDetected={isFaceDetected}
          violations={proctoringEvents}
          showWarning={showWarning}
          lastViolation={lastViolation}
        />

        <div className="mt-auto">
          <button
            onClick={() => setShowQuitConfirm(true)}
            className="w-full py-3 text-gray-400 hover:text-red-600 text-sm font-medium transition-colors"
          >
            Quit Test
          </button>
        </div>
      </aside>

      {/* Main Content - Test Area */}
      <main className="flex-grow flex flex-col relative">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{moduleId?.toUpperCase()} Placement Test</h2>
            <p className="text-xs text-gray-500">Question {currentQuestionIndex + 1} of {questions.length}</p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 text-primary rounded-xl font-mono font-bold">
              <Clock size={18} />
              {formatTime(timeLeft)}
            </div>
            <button
              onClick={() => setIsFinished(true)}
              className="bg-primary text-white px-6 py-2 rounded-xl font-bold hover:bg-primary-hover transition-all text-sm"
            >
              Finish Test
            </button>
          </div>
        </header>

        {/* Question Area */}
        <div className="flex-grow overflow-y-auto p-8 lg:p-12">
          <div className="max-w-3xl mx-auto">
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-12"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-8 leading-relaxed">
                {currentQuestion.text}
              </h3>
              
              <div className="grid gap-4">
                {currentQuestion.options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    className={cn(
                      "w-full p-6 rounded-[1.5rem] text-left border-2 transition-all flex items-center justify-between group",
                      answers[currentQuestion.id] === i
                        ? "border-primary bg-primary/5 ring-4 ring-primary/5"
                        : "border-gray-100 bg-white hover:border-primary/20"
                    )}
                  >
                    <span className={cn(
                      "font-medium text-lg",
                      answers[currentQuestion.id] === i ? "text-primary" : "text-gray-700"
                    )}>
                      {option}
                    </span>
                    <div className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                      answers[currentQuestion.id] === i
                        ? "border-primary bg-primary text-white"
                        : "border-gray-200 group-hover:border-primary/30"
                    )}>
                      {answers[currentQuestion.id] === i && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Footer Navigation */}
        <footer className="bg-white border-t border-gray-200 px-8 py-6">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <button
              onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
              disabled={currentQuestionIndex === 0}
              className="flex items-center gap-2 text-gray-500 font-bold hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={20} />
              Previous
            </button>
            
            <div className="flex gap-2">
              {questions.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    i === currentQuestionIndex ? "w-8 bg-primary" : "bg-gray-200"
                  )}
                />
              ))}
            </div>

            <button
              onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
              disabled={currentQuestionIndex === questions.length - 1}
              className="flex items-center gap-2 text-gray-500 font-bold hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight size={20} />
            </button>
          </div>
        </footer>
      </main>

      {/* Quit Confirmation Modal */}
      <AnimatePresence>
        {showQuitConfirm && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-gray-100"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-6">
                <Shield size={32} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Quit Test?</h3>
              <p className="text-gray-500 font-medium mb-8">
                Are you sure you want to quit the test? This action will be logged and your progress will be lost.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowQuitConfirm(false)}
                  className="flex-1 px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 px-6 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                >
                  Quit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
