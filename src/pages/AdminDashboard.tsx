import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Users, 
  FileText, 
  AlertCircle, 
  Search, 
  Bell,
  ChevronDown,
  LayoutDashboard,
  BookOpen,
  HelpCircle,
  Eye,
  BarChart3,
  Settings,
  Lock,
  CheckCircle2,
  ArrowUpRight,
  Brain,
  Code,
  Database,
  Terminal,
  Calculator,
  Cpu,
  Trash2,
  Edit2,
  Plus,
  X,
  ArrowLeft
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc, updateDoc, addDoc, writeBatch, getDocs, where, setDoc, getDoc } from 'firebase/firestore';
import { cn } from '@/src/lib/utils';
import { db, auth, handleFirestoreError, OperationType } from '@/src/firebase';
import { UserProfile, TestResult, Question, Test, LiveSession, SupportTicket, SystemSettings, ModuleId } from '@/src/types';
import { formatDistanceToNow } from 'date-fns';
import { Video, VideoOff, Activity, Monitor, CheckCircle, XCircle, MessageSquare, Send, Palette, Globe, BellRing } from 'lucide-react';
import { useSettings } from '@/src/context/SettingsContext';

import { MOCK_QUESTIONS } from '@/src/constants/questions';

type TabType = 'dashboard' | 'users' | 'tests' | 'alerts' | 'proctoring' | 'reports' | 'settings' | 'support' | 'questions';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [search, setSearch] = useState('');
  const [testModuleFilter, setTestModuleFilter] = useState<string>('all');
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Edit/Delete States
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [viewingUserDetails, setViewingUserDetails] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [isAddingTest, setIsAddingTest] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [selectedTestForQuestions, setSelectedTestForQuestions] = useState<Test | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<{testId: string, question: Question, index: number} | null>(null);
  const [isAddingQuestionTo, setIsAddingQuestionTo] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState<Question>({
    text: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    explanation: ''
  });

  // New Test State
  const [newTest, setNewTest] = useState<Partial<Test>>({
    title: '',
    description: '',
    durationMinutes: 30,
    moduleId: 'aptitude',
    questions: []
  });

  // New User State
  const [newUser, setNewUser] = useState({
    displayName: '',
    email: '',
    role: 'student' as 'student' | 'admin'
  });

  const [replyingTicket, setReplyingTicket] = useState<SupportTicket | null>(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  const { settings, updateSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState<SystemSettings | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [toast, setToast] = useState<{show: boolean, message: string, type: 'success' | 'error'}>({
    show: false,
    message: '',
    type: 'success'
  });

  const [confirmModal, setConfirmModal] = useState<{
    show: boolean,
    title: string,
    message: string,
    onConfirm: () => void
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  useEffect(() => {
    if (settings && !localSettings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const handleSaveSettings = async () => {
    if (!localSettings) return;
    setIsSavingSettings(true);
    try {
      await updateSettings(localSettings);
      showToast('Settings updated successfully!');
    } catch (err) {
      console.error(err);
      showToast('Failed to update settings.', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  useEffect(() => {
    // Ensure the default admin always has the admin role in Firestore
    const ensureAdminRole = async () => {
      if (auth.currentUser?.email === 'mehulsharma31253@gmail.com') {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          // Create missing admin profile
          await setDoc(userRef, {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            displayName: auth.currentUser.displayName || 'Admin',
            role: 'admin',
            createdAt: new Date().toISOString()
          });
          console.log("Created missing admin profile.");
        } else if (userSnap.data().role !== 'admin') {
          // Fix incorrect role
          await updateDoc(userRef, { role: 'admin' });
          console.log("Fixed admin role for default admin account.");
        }
      }
    };
    ensureAdminRole();
  }, []);

  useEffect(() => {
    // Real-time Students
    const studentsQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      const fetchedStudents = snapshot.docs.map(doc => doc.data() as UserProfile);
      setStudents(fetchedStudents);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    // Real-time Results
    const resultsQuery = query(collection(db, 'results'), orderBy('completedAt', 'desc'));
    const unsubscribeResults = onSnapshot(resultsQuery, (snapshot) => {
      const fetchedResults = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TestResult[];
      setResults(fetchedResults);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'results'));

    // Real-time Tests
    const testsQuery = query(collection(db, 'tests'));
    const unsubscribeTests = onSnapshot(testsQuery, (snapshot) => {
      const fetchedTests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Test[];
      setTests(fetchedTests);
      
      // Update selectedTestForQuestions if it's currently being viewed
      setSelectedTestForQuestions(prev => {
        if (!prev) return null;
        const updated = fetchedTests.find(t => t.id === prev.id);
        return updated || null;
      });
      
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tests'));

    // Real-time Live Sessions
    const liveSessionsQuery = query(collection(db, 'live_sessions'));
    const unsubscribeLiveSessions = onSnapshot(liveSessionsQuery, (snapshot) => {
      const fetchedSessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LiveSession[];
      setLiveSessions(fetchedSessions);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'live_sessions'));

    // Real-time Support Tickets
    const ticketsQuery = query(collection(db, 'support_tickets'), orderBy('createdAt', 'desc'));
    const unsubscribeTickets = onSnapshot(ticketsQuery, (snapshot) => {
      const fetchedTickets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SupportTicket[];
      setSupportTickets(fetchedTickets);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'support_tickets'));

    return () => {
      unsubscribeStudents();
      unsubscribeResults();
      unsubscribeTests();
      unsubscribeLiveSessions();
      unsubscribeTickets();
    };
  }, []);

  const stats = useMemo(() => {
    const totalUsers = students.length;
    const activeTests = results.filter(r => {
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      return r.completedAt > tenMinsAgo;
    }).length;
    const totalSubmissions = results.length;
    const historicalAlerts = results.reduce((acc, r) => acc + (r.proctoringEvents?.length || 0), 0);
    const liveAlerts = liveSessions.reduce((acc, s) => acc + (s.violationCount || 0), 0);

    return { totalUsers, activeTests, totalSubmissions, cheatingAlerts: historicalAlerts + liveAlerts };
  }, [students, results, liveSessions]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => 
      s.uid !== auth.currentUser?.uid && (
        s.displayName.toLowerCase().includes(search.toLowerCase()) || 
        s.email.toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [students, search]);

  const handleDeleteUser = async (uid: string) => {
    try {
      // 1. Delete from Firebase Auth via server
      const authResponse = await fetch('/api/admin/delete-user-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid }),
      });
      
      if (!authResponse.ok) {
        const errData = await authResponse.json();
        console.warn("Auth deletion warning:", errData.error);
        // We continue even if Auth deletion fails (e.g. user manually created in Firestore only)
      }

      // 2. Delete from Firestore using Batch
      const batch = writeBatch(db);
      
      // Delete user document
      batch.delete(doc(db, 'users', uid));
      
      // Delete all results for this user
      const resultsQuery = query(collection(db, 'results'), where('userId', '==', uid));
      const resultsSnapshot = await getDocs(resultsQuery);
      resultsSnapshot.forEach((resultDoc) => {
        batch.delete(resultDoc.ref);
      });
      
      await batch.commit();
      setUserToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid} and history`);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await updateDoc(doc(db, 'users', editingUser.uid), {
        displayName: editingUser.displayName,
        role: editingUser.role
      });
      setEditingUser(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${editingUser.uid}`);
    }
  };

  const handleDeleteTest = async (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Delete Test',
      message: 'Are you sure you want to delete this test? This action cannot be undone.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'tests', id));
          showToast('Test deleted successfully!');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `tests/${id}`);
          showToast('Failed to delete test.', 'error');
        } finally {
          setConfirmModal(prev => ({ ...prev, show: false }));
        }
      }
    });
  };

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'tests'), {
        ...newTest,
        questions: []
      });
      setIsAddingTest(false);
      setNewTest({ title: '', description: '', durationMinutes: 30, moduleId: 'aptitude', questions: [] });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'tests');
    }
  };

  const handleUpdateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTest) return;
    try {
      await updateDoc(doc(db, 'tests', editingTest.id), {
        title: editingTest.title,
        description: editingTest.description,
        durationMinutes: editingTest.durationMinutes,
        moduleId: editingTest.moduleId
      });
      setEditingTest(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tests/${editingTest.id}`);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Note: In a real app, you'd use Firebase Auth to create the user.
      // For this demo, we'll just add to the 'users' collection with a consistent ID.
      const tempUid = Math.random().toString(36).substring(7);
      await setDoc(doc(db, 'users', tempUid), {
        ...newUser,
        uid: tempUid,
        createdAt: new Date().toISOString()
      });
      setIsAddingUser(false);
      setNewUser({ displayName: '', email: '', role: 'student' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'users');
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddingQuestionTo) return;
    const test = tests.find(t => t.id === isAddingQuestionTo);
    if (!test) return;

    try {
      const questionId = Math.random().toString(36).substring(7);
      const updatedQuestions = [...test.questions, { ...newQuestion, id: questionId }];
      await updateDoc(doc(db, 'tests', isAddingQuestionTo), {
        questions: updatedQuestions
      });
      setIsAddingQuestionTo(null);
      setNewQuestion({ id: '', text: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' });
      showToast('Question added successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tests/${isAddingQuestionTo}`);
      showToast('Failed to add question.', 'error');
    }
  };

  const handleUpdateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;
    const test = tests.find(t => t.id === editingQuestion.testId);
    if (!test) return;

    try {
      const updatedQuestions = [...test.questions];
      updatedQuestions[editingQuestion.index] = editingQuestion.question;
      await updateDoc(doc(db, 'tests', editingQuestion.testId), {
        questions: updatedQuestions
      });
      setEditingQuestion(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tests/${editingQuestion.testId}`);
    }
  };

  const handleDeleteQuestion = async (testId: string, index: number) => {
    setConfirmModal({
      show: true,
      title: 'Delete Question',
      message: 'Are you sure you want to delete this question?',
      onConfirm: async () => {
        const test = tests.find(t => t.id === testId);
        if (!test) return;

        try {
          const updatedQuestions = test.questions.filter((_, i) => i !== index);
          await updateDoc(doc(db, 'tests', testId), {
            questions: updatedQuestions
          });
          showToast('Question deleted successfully!');
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `tests/${testId}`);
          showToast('Failed to delete question.', 'error');
        } finally {
          setConfirmModal(prev => ({ ...prev, show: false }));
        }
      }
    });
  };

  const handleSeedQuestions = async () => {
    setConfirmModal({
      show: true,
      title: 'Seed Default Questions',
      message: 'This will create default tests with pre-defined questions for all modules. Continue?',
      onConfirm: async () => {
        try {
          const batch = writeBatch(db);
          
          Object.entries(MOCK_QUESTIONS).forEach(([moduleId, questions]) => {
            const testId = `default_${moduleId}`;
            const testRef = doc(db, 'tests', testId);
            batch.set(testRef, {
              id: testId,
              moduleId: moduleId as ModuleId,
              title: `Default ${moduleId.toUpperCase()} Test`,
              description: `Standard practice test for ${moduleId.toUpperCase()}`,
              durationMinutes: 10,
              questions: questions,
              createdAt: new Date().toISOString()
            });
          });

          await batch.commit();
          showToast('Default questions seeded successfully!');
        } catch (err) {
          console.error(err);
          showToast('Failed to seed questions.', 'error');
        } finally {
          setConfirmModal(prev => ({ ...prev, show: false }));
        }
      }
    });
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      window.location.href = '/';
    } catch (err) {
      console.error(err);
    }
  };

  const recentSubmissions = useMemo(() => results.slice(0, 4), [results]);
  const proctoringAlerts = useMemo(() => {
    const activeAlerts = liveSessions
      .filter(s => s.violationCount > 0)
      .map(s => ({
        id: `live-${s.id}`,
        userId: s.userId,
        moduleId: s.moduleId,
        proctoringEvents: s.latestViolation ? [s.latestViolation] : [],
        isLive: true,
        displayName: s.displayName,
        userEmail: s.userEmail,
        timestamp: Date.now()
      }));
      
    const historicalAlerts = results
      .filter(r => (r.proctoringEvents?.length || 0) > 0)
      .map(r => {
        const student = students.find(s => s.uid === r.userId);
        return {
          id: r.id,
          userId: r.userId,
          moduleId: r.moduleId,
          proctoringEvents: r.proctoringEvents,
          isLive: false,
          displayName: student?.displayName || 'Unknown',
          userEmail: student?.email || 'Unknown',
          timestamp: new Date(r.completedAt).getTime(),
          score: r.score,
          totalQuestions: r.totalQuestions
        };
      });

    return [...activeAlerts, ...historicalAlerts].sort((a, b) => b.timestamp - a.timestamp);
  }, [liveSessions, results, students]);

  const handleRemoteAction = async (userId: string, action: 'submit' | 'cancel') => {
    setActionLoading(userId);
    try {
      await updateDoc(doc(db, 'live_sessions', userId), {
        remoteCommand: action
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'live_sessions');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteResult = async (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Delete Record',
      message: 'Are you sure you want to delete this record?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'results', id));
          showToast('Record deleted successfully!');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, 'results');
          showToast('Failed to delete record.', 'error');
        } finally {
          setConfirmModal(prev => ({ ...prev, show: false }));
        }
      }
    });
  };

  const handleReplyTicket = async () => {
    if (!replyingTicket || !adminReplyText || isReplying) return;

    setIsReplying(true);
    try {
      await updateDoc(doc(db, 'support_tickets', replyingTicket.id), {
        adminReply: adminReplyText,
        repliedAt: new Date().toISOString(),
        status: 'replied',
        isReadByAdmin: true,
        isReadByStudent: false
      });
      setReplyingTicket(null);
      setAdminReplyText('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'support_tickets');
    } finally {
      setIsReplying(false);
    }
  };

  const markTicketAsRead = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'support_tickets', ticketId), {
        isReadByAdmin: true
      });
    } catch (err) {
      console.error("Error marking ticket as read:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f7fe]">
        <div className="w-12 h-12 border-4 border-[#4f46e5] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f4f7fe] font-sans text-[#1b2559]">
      {/* Sidebar */}
      <aside className="w-72 bg-[#111c44] text-white flex flex-col fixed h-full z-50">
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <Shield size={24} className="text-white" />
          </div>
          <div className="leading-tight">
            <h1 className="text-xl font-bold">Proctored</h1>
            <p className="text-xs text-gray-400 font-medium tracking-widest">COURSES</p>
          </div>
        </div>

        <nav className="flex-grow px-4 mt-4 space-y-2">
          {[
            { icon: LayoutDashboard, label: "Dashboard", id: 'dashboard' },
            { icon: Users, label: "Users", id: 'users' },
            { icon: BookOpen, label: "Tests", id: 'tests' },
            { icon: HelpCircle, label: "Questions", id: 'questions' },
            { icon: AlertCircle, label: "Cheating Alerts", id: 'alerts', badge: proctoringAlerts.length || undefined },
            { icon: MessageSquare, label: "Support", id: 'support', badge: supportTickets.filter(t => !t.isReadByAdmin).length || undefined },
            { icon: Eye, label: "Proctoring", id: 'proctoring', badge: liveSessions.length > 0 ? liveSessions.length : undefined },
            { icon: BarChart3, label: "Reports", id: 'reports' },
            { icon: Settings, label: "Settings", id: 'settings' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as TabType)}
              className={cn(
                "w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-bold text-sm relative",
                activeTab === item.id 
                  ? "bg-white/10 text-white" 
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon size={20} />
              {item.label}
              {item.badge && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center animate-pulse">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-6 space-y-4">
          <div className="bg-[#1b2559] rounded-3xl p-6 border border-white/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.currentUser?.email}`} alt="Admin" />
              </div>
              <div>
                <p className="text-sm font-bold">Admin</p>
                <p className="text-[10px] text-gray-400 truncate max-w-[120px]">{auth.currentUser?.email}</p>
              </div>
            </div>
            <div 
              onClick={() => setShowAlerts(!showAlerts)}
              className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:bg-red-500/20 transition-all relative"
            >
              <div className="flex items-center gap-3">
                <AlertCircle size={18} className="text-red-500" />
                <div>
                  <p className="text-xs font-bold text-red-500">Alert: {stats.cheatingAlerts}</p>
                  <p className="text-[10px] text-gray-400">Cheating Incidents</p>
                </div>
              </div>
              <ChevronDown size={14} className={cn("text-gray-400 transition-transform", showAlerts && "rotate-180")} />
              
              <AnimatePresence>
                {showAlerts && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-0 w-full mb-2 bg-[#1b2559] border border-white/10 rounded-2xl p-4 shadow-2xl z-50"
                  >
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-3">Recent Alerts</p>
                    <div className="space-y-3">
                      {proctoringAlerts.slice(0, 5).map((a, i) => (
                        <div key={i} className="text-[10px] border-l-2 border-red-500 pl-2">
                          <div className="flex items-center gap-1">
                            <p className="font-bold text-white truncate">{a.displayName}</p>
                            {a.isLive && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />}
                          </div>
                          <p className="text-gray-400 truncate">{a.proctoringEvents?.[0]?.type || 'Violation'}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow ml-72 p-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-[#1b2559] capitalize">{activeTab} Dashboard</h2>
          
          <div className="flex items-center gap-6">
            <div className="relative w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border-none rounded-2xl py-3 pl-12 pr-4 outline-none focus:ring-primary transition-all shadow-sm text-sm font-medium"
              />
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative">
                <button 
                  onClick={() => {
                    setActiveTab('support');
                    setShowNotifications(false);
                  }}
                  className="relative p-2 text-gray-400 hover:text-[#1b2559] transition-colors"
                >
                  <Bell size={22} />
                  {supportTickets.some(t => !t.isReadByAdmin) && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#f4f7fe]">
                      {supportTickets.filter(t => !t.isReadByAdmin).length}
                    </span>
                  )}
                </button>
                
                <AnimatePresence>
                  {showNotifications && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full right-0 w-80 mt-4 bg-white rounded-3xl shadow-2xl p-6 z-50 border border-gray-50"
                    >
                      <h4 className="text-sm font-black mb-4">Notifications</h4>
                      <div className="space-y-4">
                        {proctoringAlerts.slice(0, 5).map((a, i) => (
                          <div key={i} className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                              <AlertCircle size={14} className="text-red-500" />
                            </div>
                            <div>
                              <p className="text-xs font-bold">{a.displayName} flagged {a.isLive ? '(LIVE)' : ''}</p>
                              <p className="text-[10px] text-gray-400">{a.proctoringEvents?.[0]?.type || 'Suspicious activity'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-3 pl-4 border-l border-gray-200 relative">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.currentUser?.email}`} alt="Admin" />
                </div>
                <div 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-1 cursor-pointer group"
                >
                  <span className="text-sm font-bold">Admin</span>
                  <ChevronDown size={14} className={cn("text-gray-400 transition-transform", showProfileMenu && "rotate-180")} />
                </div>

                <AnimatePresence>
                  {showProfileMenu && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full right-0 w-48 mt-4 bg-white rounded-2xl shadow-2xl p-2 z-50 border border-gray-50"
                    >
                      <button 
                        onClick={() => setActiveTab('settings')}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-xl text-sm font-bold transition-all"
                      >
                        <Settings size={16} /> Settings
                      </button>
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 text-red-600 rounded-xl text-sm font-bold transition-all"
                      >
                        <Lock size={16} /> Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-5 gap-6 mb-8">
                {[
                  { label: "Total Users", value: stats.totalUsers.toLocaleString(), icon: Users, color: "bg-primary", shadow: "shadow-primary/20" },
                  { label: "Active Tests", value: stats.activeTests.toLocaleString(), icon: FileText, color: "bg-[#05cd99]", shadow: "shadow-[#05cd99]/20" },
                  { label: "Submissions", value: stats.totalSubmissions.toLocaleString(), icon: CheckCircle2, color: "bg-[#ffb547]", shadow: "shadow-[#ffb547]/20", sub: "+5.2% last week" },
                  { label: "Cheating Alerts", value: stats.cheatingAlerts.toLocaleString(), icon: AlertCircle, color: "bg-[#ee5d50]", shadow: "shadow-[#ee5d50]/20", sub: "-25 today" },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm flex items-center gap-4">
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white", stat.color, stat.shadow)}>
                      <stat.icon size={28} />
                    </div>
                    <div>
                      <p className="text-2xl font-black">{stat.value}</p>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                      {stat.sub && <p className="text-[10px] font-bold text-emerald-500 mt-1">{stat.sub}</p>}
                    </div>
                  </div>
                ))}
                <div className="bg-[#e9edf7] p-6 rounded-[2rem] flex items-center justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-[#1b2559] shadow-sm">
                    <Lock size={28} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-8">
                {/* Users Overview Table */}
                <div className="col-span-2 bg-white rounded-[2.5rem] p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black">Users Overview</h3>
                    <div className="flex gap-4">
                      <button onClick={() => setActiveTab('users')} className="text-sm font-bold text-primary hover:underline">View All Users</button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50">
                          <th className="pb-4">ID</th>
                          <th className="pb-4">Name</th>
                          <th className="pb-4">Email</th>
                          <th className="pb-4">Module Progress</th>
                          <th className="pb-4">Scores</th>
                          <th className="pb-4">Cheating Alerts</th>
                          <th className="pb-4">Last Login</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredStudents.slice(0, 7).map((student, i) => {
                          const studentResults = results.filter(r => r.userId === student.uid);
                          const violations = studentResults.reduce((acc, r) => acc + (r.proctoringEvents?.length || 0), 0);
                          const avgScore = studentResults.length > 0 
                            ? Math.round(studentResults.reduce((acc, r) => acc + (r.totalQuestions > 0 ? r.score / r.totalQuestions : 0), 0) / studentResults.length * 100)
                            : 0;

                          return (
                            <tr key={student.uid} className="group hover:bg-gray-50/50 transition-colors">
                              <td className="py-5 text-xs font-bold text-gray-400">100{i + 1}</td>
                              <td className="py-5">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold">{student.displayName}</span>
                                  <button 
                                    onClick={() => setViewingUserDetails(student)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-primary hover:bg-primary/5 rounded-lg transition-all"
                                  >
                                    <Eye size={14} />
                                  </button>
                                </div>
                              </td>
                              <td className="py-5 text-xs text-gray-400">{student.email}</td>
                              <td className="py-5">
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-6 bg-gray-100 rounded-lg overflow-hidden relative">
                                    <div className="h-full bg-primary w-[85%]" />
                                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white">85% - Aptitude</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-5 text-sm font-bold">{avgScore}</td>
                              <td className="py-5">
                                {violations > 0 ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[10px] font-black border border-red-100">
                                    <AlertCircle size={10} />
                                    YES <span className="bg-red-500 text-white px-1 rounded-sm">{violations}</span>
                                  </span>
                                ) : (
                                  <span className="text-xs font-bold text-gray-400">No</span>
                                )}
                              </td>
                              <td className="py-5 text-xs font-bold text-gray-400">
                                {formatDistanceToNow(new Date(student.createdAt), { addSuffix: true })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="mt-8 flex justify-center gap-4">
                    <button onClick={() => setActiveTab('users')} className="px-8 py-3 bg-[#e9edf7] text-[#1b2559] rounded-2xl text-xs font-bold hover:bg-gray-200 transition-all">View All Users</button>
                  </div>
                </div>

                {/* Right Sidebar Lists */}
                <div className="space-y-8">
                  {/* Recent Test Submissions */}
                  <div className="bg-white rounded-[2.5rem] p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-black">Recent Test Submissions</h3>
                      <button onClick={() => setActiveTab('reports')} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">View All <ArrowUpRight size={12} /></button>
                    </div>
                    <div className="space-y-6">
                      {recentSubmissions.map((res) => {
                        const student = students.find(s => s.uid === res.userId);
                        const scorePercent = res.totalQuestions > 0 ? Math.round((res.score / res.totalQuestions) * 100) : 0;
                        return (
                          <div key={res.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student?.email}`} alt="Student" />
                              </div>
                              <div>
                                <p className="text-sm font-bold">{student?.displayName || 'Unknown'}</p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase">{res.moduleId} • {formatDistanceToNow(new Date(res.completedAt), { addSuffix: true })}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{res.moduleId.toUpperCase()}</p>
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-black">{scorePercent}%</span>
                                {scorePercent >= 70 ? <CheckCircle2 size={14} className="text-emerald-500" /> : <AlertCircle size={14} className="text-red-500" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Proctoring Alerts */}
                  <div className="bg-white rounded-[2.5rem] p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-black">Proctoring Alerts</h3>
                      <button onClick={() => setActiveTab('proctoring')} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">View All <ArrowUpRight size={12} /></button>
                    </div>
                    <div className="space-y-6">
                      {proctoringAlerts.map((alert) => {
                        const student = students.find(s => s.uid === alert.userId);
                        const latestEvent = alert.proctoringEvents?.[alert.proctoringEvents.length - 1];
                        return (
                          <div key={alert.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
                                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student?.email}`} alt="Student" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold">{student?.displayName || 'Unknown'}</p>
                                  <p className="text-[10px] text-gray-400 font-bold uppercase">{alert.moduleId}</p>
                                </div>
                              </div>
                              <span className={cn(
                                "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                                (alert.proctoringEvents?.length || 0) > 3 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                              )}>
                                {(alert.proctoringEvents?.length || 0) > 3 ? "Inactive" : "Active"}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                              {latestEvent?.type.replace('_', ' ')} detected, {latestEvent?.details || 'suspicious activity observed'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Module Grid */}
              <div className="mt-8 grid grid-cols-3 gap-6">
                {[
                  { label: "Aptitude & Reasoning", id: 'aptitude', icon: Brain, color: "text-blue-500", bg: "bg-blue-50" },
                  { label: "Data Structures & Algorithms", id: 'dsa', icon: Code, color: "text-emerald-500", bg: "bg-emerald-50" },
                  { label: "Database Management", id: 'dbms', icon: Database, color: "text-orange-500", bg: "bg-orange-50" },
                  { label: "Programming", id: 'programming', icon: Terminal, color: "text-indigo-500", bg: "bg-indigo-50" },
                  { label: "Math IT", id: 'math', icon: Calculator, color: "text-blue-600", bg: "bg-blue-50" },
                  { label: "Core CS", id: 'cs-core', icon: Cpu, color: "text-gray-600", bg: "bg-gray-50" },
                ].map((module, i) => (
                  <div 
                    key={i} 
                    onClick={() => {
                      setTestModuleFilter(module.id);
                      setActiveTab('tests');
                    }}
                    className="bg-white p-6 rounded-[2rem] shadow-sm flex items-center gap-4 group cursor-pointer hover:shadow-md transition-all"
                  >
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", module.bg)}>
                      <module.icon className={module.color} size={24} />
                    </div>
                    <p className="text-sm font-bold text-[#1b2559]">{module.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-[2.5rem] p-8 shadow-sm"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black">User Management</h3>
                <button 
                  onClick={() => setIsAddingUser(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl text-sm font-bold hover:bg-primary-hover transition-all"
                >
                  <Plus size={18} /> Add New User
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50">
                      <th className="pb-4">Name</th>
                      <th className="pb-4">Email</th>
                      <th className="pb-4">Role</th>
                      <th className="pb-4">Joined</th>
                      <th className="pb-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredStudents.map((student) => (
                      <tr key={student.uid} className="group hover:bg-gray-50/50 transition-colors">
                        <td className="py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden">
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.email}`} alt="User" />
                            </div>
                            <span className="text-sm font-bold">{student.displayName}</span>
                          </div>
                        </td>
                        <td className="py-5 text-sm text-gray-400">{student.email}</td>
                        <td className="py-5">
                          <span className={cn(
                            "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                            student.role === 'admin' ? "bg-primary/5 text-primary" : "bg-gray-50 text-gray-600"
                          )}>
                            {student.role}
                          </span>
                        </td>
                        <td className="py-5 text-sm text-gray-400">
                          {new Date(student.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setViewingUserDetails(student)}
                              className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                              title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                            <button 
                              onClick={() => setEditingUser(student)}
                              className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                              title="Edit User"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => setUserToDelete(student)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                              title="Delete User"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'tests' && (
            <motion.div
              key="tests"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-[2.5rem] p-8 shadow-sm"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black">Test Management</h3>
                <div className="flex gap-4">
                  <select 
                    value={testModuleFilter}
                    onChange={(e) => setTestModuleFilter(e.target.value)}
                    className="bg-gray-50 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
                  >
                    <option value="all">All Modules</option>
                    <option value="aptitude">Aptitude</option>
                    <option value="dsa">DSA</option>
                    <option value="dbms">DBMS</option>
                    <option value="cs-core">CS Core</option>
                  </select>
                  <button 
                    onClick={() => setIsAddingTest(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl text-sm font-bold hover:bg-primary-hover transition-all"
                  >
                    <Plus size={18} /> Create New Test
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tests.filter(t => testModuleFilter === 'all' || t.moduleId === testModuleFilter).map((test) => (
                  <div key={test.id} className="bg-[#f4f7fe] p-6 rounded-3xl border border-gray-100 group relative">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                        <BookOpen className="text-primary" size={24} />
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setEditingTest(test)}
                          className="p-2 bg-white text-gray-400 hover:text-primary rounded-xl shadow-sm"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteTest(test.id)}
                          className="p-2 bg-white text-gray-400 hover:text-red-600 rounded-xl shadow-sm"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <h4 className="text-lg font-black mb-2">{test.title}</h4>
                    <p className="text-xs text-gray-400 font-bold uppercase mb-4">{test.moduleId} • {test.durationMinutes} Mins</p>
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-gray-400">{test.questions.length} Questions</span>
                      <span 
                        onClick={() => {
                          setSelectedTestForQuestions(test);
                          setActiveTab('questions');
                        }}
                        className="text-primary hover:underline cursor-pointer"
                      >
                        Manage Questions
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'proctoring' && (
            <motion.div
              key="proctoring"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* Live Sessions Section */}
              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-black flex items-center gap-2">
                      Live Test Sessions
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                    </h3>
                    <p className="text-sm text-gray-400 font-bold">Real-time monitoring of active students</p>
                  </div>
                  <div className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest">
                    {liveSessions.length} Active Now
                  </div>
                </div>

                {liveSessions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {liveSessions.map((session) => (
                      <div 
                        key={session.id} 
                        className={cn(
                          "p-6 rounded-[2rem] border-2 transition-all relative overflow-hidden",
                          session.proctoringStatus === 'critical' ? "bg-red-50 border-red-100" : 
                          session.proctoringStatus === 'warning' ? "bg-orange-50 border-orange-100" : 
                          "bg-emerald-50 border-emerald-100"
                        )}
                      >
                        {/* Status Bar */}
                        <div className={cn(
                          "absolute top-0 left-0 w-full h-1",
                          session.proctoringStatus === 'critical' ? "bg-red-500" : 
                          session.proctoringStatus === 'warning' ? "bg-orange-500" : 
                          "bg-emerald-500"
                        )} />

                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm overflow-hidden border-2 border-white">
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${session.userEmail}`} alt="User" />
                            </div>
                            <div>
                              <p className="text-sm font-black truncate max-w-[120px]">{session.displayName}</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase">{session.moduleId}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black">{Math.round((session.score / (session.totalQuestions || 1)) * 100)}%</p>
                            <p className="text-[10px] text-gray-400 font-bold">Current Score</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl">
                            <div className="flex items-center gap-2 mb-1">
                              {session.isFaceDetected ? <Video size={14} className="text-emerald-500" /> : <VideoOff size={14} className="text-red-500" />}
                              <p className="text-[10px] font-black uppercase tracking-widest">Camera</p>
                            </div>
                            <p className="text-xs font-bold">{session.isFaceDetected ? 'Detected' : 'Missing'}</p>
                          </div>
                          <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl">
                            <div className="flex items-center gap-2 mb-1">
                              <Activity size={14} className="text-primary" />
                              <p className="text-[10px] font-black uppercase tracking-widest">Progress</p>
                            </div>
                            <p className="text-xs font-bold">{session.currentQuestionIndex + 1} / {session.totalQuestions}</p>
                          </div>
                        </div>

                        {session.latestViolation && (
                          <div className="bg-white/40 p-3 rounded-xl border border-white/20 mb-4">
                            <div className="flex items-center gap-2 mb-1">
                              <AlertCircle size={12} className="text-red-500" />
                              <p className="text-[10px] font-black text-red-600 uppercase">Latest Alert</p>
                            </div>
                            <p className="text-[10px] font-bold text-gray-600 truncate">{session.latestViolation.type.replace('_', ' ')}: {session.latestViolation.details}</p>
                          </div>
                        )}

                        <div className="flex items-center justify-between mb-4">
                          <p className="text-[10px] text-gray-400 font-bold">
                            Last active: {formatDistanceToNow(new Date(session.lastHeartbeat), { addSuffix: true })}
                          </p>
                          <span className={cn(
                            "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                            session.proctoringStatus === 'critical' ? "bg-red-500 text-white" : 
                            session.proctoringStatus === 'warning' ? "bg-orange-500 text-white" : 
                            "bg-emerald-500 text-white"
                          )}>
                            {session.proctoringStatus}
                          </span>
                        </div>

                        {/* Remote Actions */}
                        <div className="flex gap-2 mt-4 pt-4 border-t border-black/5">
                          <button
                            onClick={() => handleRemoteAction(session.userId, 'submit')}
                            disabled={actionLoading === session.userId}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50"
                          >
                            <CheckCircle size={14} />
                            Submit
                          </button>
                          <button
                            onClick={() => handleRemoteAction(session.userId, 'cancel')}
                            disabled={actionLoading === session.userId}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50"
                          >
                            <XCircle size={14} />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100">
                    <Monitor size={48} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-400 font-bold">No active test sessions at the moment</p>
                  </div>
                )}
              </div>

              {/* Historical Logs Section */}
              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm">
                <h3 className="text-xl font-black mb-8">Historical Proctoring Logs</h3>
                <div className="space-y-4">
                  {results.filter(r => (r.proctoringEvents?.length || 0) > 0).map((res) => {
                    const student = students.find(s => s.uid === res.userId);
                    return (
                      <div key={res.id} className="p-6 bg-red-50/50 rounded-3xl border border-red-100">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white overflow-hidden border border-red-200">
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student?.email}`} alt="User" />
                            </div>
                            <div>
                              <p className="text-sm font-bold">{student?.displayName}</p>
                              <p className="text-[10px] text-red-600 font-black uppercase">{res.moduleId} Test</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-gray-400">
                            {formatDistanceToNow(new Date(res.completedAt), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {res.proctoringEvents.map((event, idx) => (
                            <div key={idx} className="flex items-center gap-3 text-xs">
                              <AlertCircle size={14} className="text-red-500" />
                              <span className="font-bold text-red-700">{event.type.replace('_', ' ').toUpperCase()}:</span>
                              <span className="text-gray-600">{event.details}</span>
                              <span className="ml-auto text-gray-400">{new Date(event.timestamp).toLocaleTimeString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'alerts' && (
            <motion.div
              key="alerts"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-black text-[#1b2559]">Cheating Alerts</h3>
                    <p className="text-sm text-gray-400 font-bold">Review and manage proctoring violations</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest animate-pulse">
                      {proctoringAlerts.filter(a => a.isLive).length} Live Violations
                    </div>
                    <div className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest">
                      {proctoringAlerts.length} Total Alerts
                    </div>
                  </div>
                </div>

                <div className="grid gap-6">
                  {proctoringAlerts.map((alert) => {
                    const student = students.find(s => s.uid === alert.userId);
                    return (
                      <div key={alert.id} className={cn(
                        "p-8 rounded-[2.5rem] border-2 transition-all group",
                        alert.isLive ? "bg-red-50/30 border-red-200" : "bg-gray-50 border-transparent hover:border-red-100"
                      )}>
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm overflow-hidden border-2 border-white relative">
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${alert.userEmail}`} alt="User" />
                              {alert.isLive && (
                                <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                                  <span className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-lg font-black text-[#1b2559]">{alert.displayName}</h4>
                                {alert.isLive && (
                                  <span className="px-2 py-0.5 bg-red-600 text-white text-[8px] font-black uppercase rounded-full animate-pulse">Live Test</span>
                                )}
                              </div>
                              <p className="text-xs font-bold text-gray-400">{alert.userEmail}</p>
                              <div className="flex gap-2 mt-2">
                                <span className="px-2 py-1 bg-primary/5 text-primary rounded-lg text-[10px] font-black uppercase tracking-widest">
                                  {alert.moduleId}
                                </span>
                                <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                  {alert.proctoringEvents.length} Violations
                                </span>
                                {student && (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                    Joined {new Date(student.createdAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => student && setViewingUserDetails(student)}
                              className="p-3 bg-white text-gray-400 hover:text-primary rounded-2xl shadow-sm transition-all"
                              title="View Full Student Details"
                            >
                              <Eye size={18} />
                            </button>
                            {!alert.isLive && (
                              <button 
                                onClick={() => handleDeleteResult(alert.id)}
                                className="p-3 bg-white text-gray-400 hover:text-red-500 rounded-2xl shadow-sm transition-all"
                                title="Delete Alert"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                            {alert.isLive && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleRemoteAction(alert.userId, 'submit')}
                                  className="p-3 bg-emerald-500 text-white rounded-2xl shadow-sm hover:bg-emerald-600 transition-all"
                                  title="Force Submit"
                                >
                                  <CheckCircle size={18} />
                                </button>
                                <button
                                  onClick={() => handleRemoteAction(alert.userId, 'cancel')}
                                  className="p-3 bg-red-500 text-white rounded-2xl shadow-sm hover:bg-red-600 transition-all"
                                  title="Terminate Session"
                                >
                                  <XCircle size={18} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3">
                          {alert.proctoringEvents.map((event, idx) => (
                            <div key={idx} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100">
                              <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                                <AlertCircle size={16} />
                              </div>
                              <div className="flex-grow">
                                <p className="text-xs font-black text-red-600 uppercase tracking-widest">{event.type.replace('_', ' ')}</p>
                                <p className="text-xs font-bold text-gray-500">{event.details}</p>
                              </div>
                              <span className="text-[10px] font-black text-gray-300 uppercase">
                                {new Date(event.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-6 flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          <span>
                            {alert.isLive ? 'Test in Progress' : `Test Completed: ${new Date(alert.timestamp).toLocaleString()}`}
                          </span>
                          {!alert.isLive && (
                            <span>Score: {alert.score}/{alert.totalQuestions} ({Math.round((alert.score! / alert.totalQuestions!) * 100)}%)</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {proctoringAlerts.length === 0 && (
                    <div className="py-20 text-center bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                      <CheckCircle2 size={48} className="mx-auto text-emerald-200 mb-4" />
                      <p className="text-gray-400 font-bold">No cheating alerts detected. Everything looks clean!</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'support' && (
            <motion.div
              key="support"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-black text-[#1b2559]">Support Tickets</h3>
                    <p className="text-sm text-gray-400 font-bold">Manage student inquiries and problems</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="px-4 py-2 bg-primary/5 text-primary rounded-xl text-xs font-black uppercase tracking-widest">
                      {supportTickets.filter(t => t.status === 'open').length} Open
                    </div>
                    <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black uppercase tracking-widest">
                      {supportTickets.filter(t => t.status === 'replied').length} Replied
                    </div>
                  </div>
                </div>

                <div className="grid gap-6">
                  {supportTickets.map((ticket) => (
                    <div 
                      key={ticket.id} 
                      className={cn(
                        "p-8 rounded-[2.5rem] border-2 transition-all group",
                        !ticket.isReadByAdmin ? "bg-indigo-50/30 border-indigo-100" : "bg-gray-50 border-transparent"
                      )}
                      onClick={() => !ticket.isReadByAdmin && markTicketAsRead(ticket.id)}
                    >
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-white shadow-sm overflow-hidden border-2 border-white">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${ticket.userEmail}`} alt="User" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-black text-[#1b2559]">{ticket.displayName}</h4>
                              {!ticket.isReadByAdmin && (
                                <span className="px-2 py-0.5 bg-primary text-white text-[8px] font-black uppercase rounded-full">New</span>
                              )}
                            </div>
                            <p className="text-xs font-bold text-gray-400">{ticket.userEmail}</p>
                            <p className="text-sm font-black text-primary mt-1">{ticket.subject}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-gray-400 uppercase">
                            {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                          </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setReplyingTicket(ticket);
                              setAdminReplyText(ticket.adminReply || '');
                            }}
                            className="p-3 bg-white text-gray-400 hover:text-primary rounded-2xl shadow-sm transition-all"
                          >
                            <Edit2 size={18} />
                          </button>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-3xl border border-gray-100 mb-6">
                        <p className="text-sm font-bold text-gray-600 leading-relaxed">{ticket.message}</p>
                      </div>

                      {ticket.adminReply && (
                        <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 relative">
                          <div className="absolute -top-3 left-6 px-3 py-1 bg-emerald-500 text-white text-[8px] font-black uppercase rounded-lg">Admin Reply</div>
                          <p className="text-sm font-bold text-emerald-700 leading-relaxed">{ticket.adminReply}</p>
                          <p className="text-[10px] font-black text-emerald-400 uppercase mt-3">
                            Replied {formatDistanceToNow(new Date(ticket.repliedAt!), { addSuffix: true })}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}

                  {supportTickets.length === 0 && (
                    <div className="py-20 text-center bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                      <MessageSquare size={48} className="mx-auto text-gray-200 mb-4" />
                      <p className="text-gray-400 font-bold">No support tickets found.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div
              key="reports"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-[2.5rem] p-8 shadow-sm"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-[#1b2559]">Performance Reports</h3>
                  <p className="text-sm text-gray-400 font-bold">Real-time student performance tracking</p>
                </div>
                <div className="flex gap-4">
                  <div className="p-4 bg-[#f4f7fe] rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Avg. Score</p>
                      <p className="text-lg font-black text-[#1b2559]">
                        {results.length > 0 
                          ? Math.round(results.reduce((acc, r) => acc + (r.totalQuestions > 0 ? r.score / r.totalQuestions : 0), 0) / results.length * 100)
                          : 0}%
                      </p>
                    </div>
                  </div>
                  <div className="p-4 bg-[#f4f7fe] rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center text-primary">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Total Tests</p>
                      <p className="text-lg font-black text-[#1b2559]">{results.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-50">
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Student</th>
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Module</th>
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Score</th>
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {results.map((result) => {
                      const student = students.find(s => s.uid === result.userId);
                      const percentage = result.totalQuestions > 0 ? Math.round((result.score / result.totalQuestions) * 100) : 0;
                      const isPassed = percentage >= 70;
                      
                      return (
                        <tr key={result.id} className="group hover:bg-gray-50/50 transition-colors">
                          <td className="py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center text-primary font-black text-xs">
                                {student?.displayName?.charAt(0) || 'U'}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-[#1b2559]">{student?.displayName || 'Unknown User'}</p>
                                <p className="text-[10px] font-bold text-gray-400">{student?.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-5">
                            <span className="text-xs font-bold text-gray-600 capitalize bg-gray-100 px-3 py-1 rounded-lg">
                              {result.moduleId}
                            </span>
                          </td>
                          <td className="py-5">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-sm font-black",
                                isPassed ? "text-green-600" : "text-red-600"
                              )}>
                                {percentage}%
                              </span>
                              <span className="text-[10px] font-bold text-gray-400">
                                ({result.score}/{result.totalQuestions})
                              </span>
                            </div>
                          </td>
                          <td className="py-5">
                            <span className={cn(
                              "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                              isPassed ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                            )}>
                              {isPassed ? 'Passed' : 'Failed'}
                            </span>
                          </td>
                          <td className="py-5 text-xs font-bold text-gray-400">
                            {new Date(result.completedAt).toLocaleDateString()}
                          </td>
                          <td className="py-5 text-right">
                            <button 
                              onClick={() => student && setViewingUserDetails(student)}
                              className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                              title="View Full Report"
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {results.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-20 text-center">
                          <div className="flex flex-col items-center gap-3 text-gray-400">
                            <FileText size={40} className="opacity-20" />
                            <p className="font-bold">No reports available yet</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'questions' && (
            <motion.div
              key="questions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-[2.5rem] p-8 shadow-sm"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  {selectedTestForQuestions && (
                    <button 
                      onClick={() => setSelectedTestForQuestions(null)}
                      className="p-2 hover:bg-gray-100 rounded-xl transition-all"
                    >
                      <ArrowLeft size={20} />
                    </button>
                  )}
                  <div>
                    <h3 className="text-xl font-black">
                      {selectedTestForQuestions ? 'Manage Questions' : 'Global Question Bank'}
                    </h3>
                    <p className="text-sm text-gray-400 font-bold">
                      {selectedTestForQuestions ? selectedTestForQuestions.title : 'All questions across all tests'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  {tests.length === 0 && (
                    <button 
                      onClick={handleSeedQuestions}
                      className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl text-sm font-bold hover:bg-emerald-600 transition-all"
                    >
                      <Database size={18} /> Seed Defaults
                    </button>
                  )}
                  {selectedTestForQuestions && (
                    <button 
                      onClick={() => setIsAddingQuestionTo(selectedTestForQuestions.id)}
                      className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl text-sm font-bold hover:bg-primary-hover transition-all"
                    >
                      <Plus size={18} /> Add Question
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-8">
                {selectedTestForQuestions ? (
                  <div className="space-y-4">
                    {selectedTestForQuestions.questions.map((q, idx) => (
                      <div key={q.id || idx} className="p-6 bg-gray-50 rounded-3xl border border-gray-100 group">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex gap-3">
                            <span className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-xs font-black shadow-sm">
                              {idx + 1}
                            </span>
                            <p className="font-bold text-gray-900">{q.text}</p>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setEditingQuestion({ testId: selectedTestForQuestions.id, question: q, index: idx })}
                              className="p-2 bg-white text-gray-400 hover:text-primary rounded-xl shadow-sm"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteQuestion(selectedTestForQuestions.id, idx)}
                              className="p-2 bg-white text-gray-400 hover:text-red-600 rounded-xl shadow-sm"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 ml-11">
                          {q.options.map((opt, oIdx) => (
                            <div 
                              key={oIdx}
                              className={cn(
                                "p-3 rounded-xl text-xs font-bold border",
                                oIdx === q.correctAnswer 
                                  ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                                  : "bg-white border-gray-100 text-gray-500"
                              )}
                            >
                              {opt}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {selectedTestForQuestions.questions.length === 0 && (
                      <div className="py-20 text-center bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                        <HelpCircle size={48} className="mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-400 font-bold">No questions added to this test yet.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-8">
                    {tests.map((test) => (
                      <div key={test.id} className="space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                          <h4 className="text-sm font-black text-[#1b2559] uppercase tracking-widest flex items-center gap-2">
                            <BookOpen size={16} className="text-primary" />
                            {test.title}
                            <span className="text-[10px] font-bold text-gray-400">({test.questions.length} Questions)</span>
                          </h4>
                          <button 
                            onClick={() => setSelectedTestForQuestions(test)}
                            className="text-[10px] font-black text-primary hover:underline uppercase"
                          >
                            Manage
                          </button>
                        </div>
                        <div className="grid gap-4">
                          {test.questions.slice(0, 3).map((q, idx) => (
                            <div key={q.id || idx} className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 flex justify-between items-center">
                              <p className="text-xs font-bold text-gray-600 truncate max-w-[80%]">{q.text}</p>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => setEditingQuestion({ testId: test.id, question: q, index: idx })}
                                  className="p-2 text-gray-400 hover:text-primary transition-colors"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteQuestion(test.id, idx)}
                                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                          {test.questions.length > 3 && (
                            <button 
                              onClick={() => setSelectedTestForQuestions(test)}
                              className="text-center py-2 text-[10px] font-bold text-gray-400 hover:text-primary transition-colors"
                            >
                              + {test.questions.length - 3} more questions
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {tests.length === 0 && (
                      <div className="py-20 text-center bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                        <HelpCircle size={48} className="mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-400 font-bold mb-4">No tests or questions found in the database.</p>
                        <button 
                          onClick={handleSeedQuestions}
                          className="px-6 py-3 bg-primary text-white rounded-2xl text-sm font-bold hover:bg-primary-hover transition-all"
                        >
                          Seed Default Questions
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && localSettings && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between bg-white rounded-[2.5rem] p-8 shadow-sm">
                <div>
                  <h3 className="text-xl font-black">System Configuration</h3>
                  <p className="text-sm text-gray-400 font-medium">Manage global platform settings and proctoring rules</p>
                </div>
                <button 
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="px-8 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {isSavingSettings ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle size={18} />
                  )}
                  Save All Changes
                </button>
              </div>

              <div className="grid grid-cols-2 gap-8">
                {/* Proctoring Settings */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                      <Shield size={20} />
                    </div>
                    <h4 className="text-lg font-black">Proctoring Rules</h4>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Face Missing Timeout (Seconds)</label>
                      <input 
                        type="number" 
                        value={localSettings.proctoring.faceMissingTimeout}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          proctoring: { ...localSettings.proctoring, faceMissingTimeout: parseInt(e.target.value) }
                        })}
                        className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-primary transition-all font-bold"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Max Tab Switches Allowed</label>
                      <input 
                        type="number" 
                        value={localSettings.proctoring.maxTabSwitches}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          proctoring: { ...localSettings.proctoring, maxTabSwitches: parseInt(e.target.value) }
                        })}
                        className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-primary transition-all font-bold"
                      />
                    </div>

                    <div className="space-y-4 pt-4">
                      {[
                        { label: "Face Detection", key: "enableFaceDetection" },
                        { label: "Tab Switch Detection", key: "enableTabSwitchDetection" },
                        { label: "Multiple Faces Detection", key: "enableMultipleFacesDetection" }
                      ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                          <span className="text-sm font-bold">{item.label}</span>
                          <button 
                            onClick={() => setLocalSettings({
                              ...localSettings,
                              proctoring: { 
                                ...localSettings.proctoring, 
                                [item.key]: !localSettings.proctoring[item.key as keyof typeof localSettings.proctoring] 
                              }
                            })}
                            className={cn(
                              "w-12 h-6 rounded-full relative transition-all duration-300",
                              localSettings.proctoring[item.key as keyof typeof localSettings.proctoring] ? "bg-primary" : "bg-gray-300"
                            )}
                          >
                            <div className={cn(
                              "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                              localSettings.proctoring[item.key as keyof typeof localSettings.proctoring] ? "right-1" : "left-1"
                            )} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Branding & Notifications */}
                <div className="space-y-8">
                  <div className="bg-white rounded-[2.5rem] p-8 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-primary">
                        <Palette size={20} />
                      </div>
                      <h4 className="text-lg font-black">Branding</h4>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Site Name</label>
                        <input 
                          type="text" 
                          value={localSettings.branding.siteName}
                          onChange={(e) => setLocalSettings({
                            ...localSettings,
                            branding: { ...localSettings.branding, siteName: e.target.value }
                          })}
                          className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-primary transition-all font-bold"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Primary Theme Color</label>
                        <div className="flex gap-4">
                          <input 
                            type="color" 
                            value={localSettings.branding.primaryColor}
                            onChange={(e) => setLocalSettings({
                              ...localSettings,
                              branding: { ...localSettings.branding, primaryColor: e.target.value }
                            })}
                            className="w-16 h-14 bg-gray-50 border-none rounded-2xl p-1 outline-none cursor-pointer"
                          />
                          <input 
                            type="text" 
                            value={localSettings.branding.primaryColor}
                            onChange={(e) => setLocalSettings({
                              ...localSettings,
                              branding: { ...localSettings.branding, primaryColor: e.target.value }
                            })}
                            className="flex-grow bg-gray-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-primary transition-all font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-[2.5rem] p-8 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                        <BellRing size={20} />
                      </div>
                      <h4 className="text-lg font-black">Notifications</h4>
                    </div>

                    <div className="space-y-4">
                      {[
                        { label: "Email Alerts (Cheating)", key: "emailAlertsEnabled" },
                        { label: "Daily Summary Report", key: "dailySummaryEnabled" },
                        { label: "New User Registration Alerts", key: "newUserAlertsEnabled" }
                      ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                          <span className="text-sm font-bold">{item.label}</span>
                          <button 
                            onClick={() => setLocalSettings({
                              ...localSettings,
                              notifications: { 
                                ...localSettings.notifications, 
                                [item.key]: !localSettings.notifications[item.key as keyof typeof localSettings.notifications] 
                              }
                            })}
                            className={cn(
                              "w-12 h-6 rounded-full relative transition-all duration-300",
                              localSettings.notifications[item.key as keyof typeof localSettings.notifications] ? "bg-primary" : "bg-gray-300"
                            )}
                          >
                            <div className={cn(
                              "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                              localSettings.notifications[item.key as keyof typeof localSettings.notifications] ? "right-1" : "left-1"
                            )} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User Details Modal */}
        {viewingUserDetails && (() => {
          const userResults = results.filter(r => r.userId === viewingUserDetails.uid);
          const testsPassed = userResults.filter(r => r.totalQuestions > 0 && (r.score / r.totalQuestions) >= 0.7).length;
          const totalAlerts = userResults.reduce((acc, r) => acc + (r.proctoringEvents?.length || 0), 0);
          const modulesLearned = new Set(userResults.filter(r => r.totalQuestions > 0 && (r.score / r.totalQuestions) >= 0.7).map(r => r.moduleId)).size;
          
          // Rank calculation
          const userAverages = students.map(s => {
            const sResults = results.filter(r => r.userId === s.uid);
            const avg = sResults.length > 0 
              ? sResults.reduce((acc, r) => acc + (r.totalQuestions > 0 ? r.score / r.totalQuestions : 0), 0) / sResults.length 
              : 0;
            return { uid: s.uid, avg };
          }).sort((a, b) => b.avg - a.avg);
          
          const rank = userAverages.findIndex(u => u.uid === viewingUserDetails.uid) + 1;

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white w-full max-w-2xl rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden"
              >
                {/* Decorative Background */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full -ml-32 -mb-32 blur-3xl" />

                <div className="relative">
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-6">
                      <div className="w-20 h-20 rounded-3xl bg-gray-100 overflow-hidden border-4 border-white shadow-xl">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${viewingUserDetails.email}`} alt="User" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-[#1b2559]">{viewingUserDetails.displayName}</h3>
                        <p className="text-sm font-bold text-gray-400">{viewingUserDetails.email}</p>
                        <span className={cn(
                          "inline-block mt-2 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                          viewingUserDetails.role === 'admin' ? "bg-primary/5 text-primary" : "bg-gray-50 text-gray-600"
                        )}>
                          {viewingUserDetails.role}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => setViewingUserDetails(null)} className="p-3 hover:bg-gray-100 rounded-2xl transition-all">
                      <X size={24} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-6 mb-10">
                    <div className="bg-[#f4f7fe] p-6 rounded-3xl">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Joined On</p>
                      <p className="text-sm font-bold">{new Date(viewingUserDetails.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="bg-[#f4f7fe] p-6 rounded-3xl">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Global Rank</p>
                      <p className="text-2xl font-black text-primary">#{rank}</p>
                    </div>
                    <div className="bg-[#f4f7fe] p-6 rounded-3xl">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Modules Learned</p>
                      <p className="text-2xl font-black text-emerald-500">{modulesLearned}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <h4 className="text-sm font-black text-[#1b2559] uppercase tracking-wider">Performance Stats</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 border border-gray-100 rounded-2xl">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Tests Passed</p>
                          <p className="text-xl font-black">{testsPassed}</p>
                        </div>
                        <div className="p-4 border border-gray-100 rounded-2xl">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Total Alerts</p>
                          <p className="text-xl font-black text-red-500">{totalAlerts}</p>
                        </div>
                      </div>
                      
                      <div className="p-6 bg-gray-50 rounded-3xl">
                        <h5 className="text-xs font-black mb-4 uppercase text-gray-400">Recent Activity</h5>
                        <div className="space-y-4">
                          {userResults.slice(0, 3).map((r, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <span className="text-xs font-bold capitalize">{r.moduleId}</span>
                              <span className="text-xs font-black">{r.totalQuestions > 0 ? Math.round((r.score / r.totalQuestions) * 100) : 0}%</span>
                            </div>
                          ))}
                          {userResults.length === 0 && <p className="text-xs text-gray-400 italic">No tests taken yet</p>}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h4 className="text-sm font-black text-[#1b2559] uppercase tracking-wider">Proctoring History</h4>
                      <div className="max-h-[200px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {userResults.flatMap(r => r.proctoringEvents || []).length > 0 ? (
                          userResults.flatMap(r => r.proctoringEvents || []).sort((a, b) => b.timestamp - a.timestamp).map((e, i) => (
                            <div key={i} className="p-3 bg-red-50 rounded-xl border border-red-100">
                              <div className="flex justify-between mb-1">
                                <span className="text-[10px] font-black text-red-600 uppercase">{e.type.replace('_', ' ')}</span>
                                <span className="text-[8px] text-gray-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <p className="text-[10px] text-gray-600 leading-tight">{e.details}</p>
                            </div>
                          ))
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full py-10 text-gray-400">
                            <CheckCircle2 size={32} className="mb-2 text-emerald-500" />
                            <p className="text-xs font-bold">Clean Record</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-10 flex gap-4">
                    <button 
                      onClick={() => {
                        setViewingUserDetails(null);
                        setEditingUser(viewingUserDetails);
                      }}
                      className="flex-1 py-4 bg-[#f4f7fe] text-[#1b2559] rounded-2xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                    >
                      <Edit2 size={18} /> Edit User Profile
                    </button>
                    <button 
                      onClick={() => {
                        setUserToDelete(viewingUserDetails);
                        setViewingUserDetails(null);
                      }}
                      className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                    >
                      <Trash2 size={18} /> Delete Account
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
        {/* Delete Confirmation Modal */}
        {userToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-md rounded-[2rem] p-8 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} className="text-red-500" />
              </div>
              <h3 className="text-xl font-black text-[#1b2559] mb-2">Delete User Account?</h3>
              <p className="text-sm text-gray-400 font-bold mb-8">
                Are you sure you want to delete <span className="text-[#1b2559]">{userToDelete.displayName}</span>? 
                This will permanently remove their profile and all test history. This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDeleteUser(userToDelete.uid)}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                >
                  Delete Account
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {editingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black">Edit User</h3>
                <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleUpdateUser} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Display Name</label>
                  <input 
                    type="text"
                    value={editingUser.displayName}
                    onChange={(e) => setEditingUser({...editingUser, displayName: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-primary font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Role</label>
                  <select 
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({...editingUser, role: e.target.value as any})}
                    className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-primary font-bold appearance-none"
                  >
                    <option value="student">Student</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="flex-1 py-4 bg-gray-100 text-[#1b2559] rounded-2xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Add User Modal */}
        {isAddingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black">Add New User</h3>
                <button onClick={() => setIsAddingUser(false)} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreateUser} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Display Name</label>
                  <input 
                    type="text"
                    required
                    value={newUser.displayName}
                    onChange={(e) => setNewUser({...newUser, displayName: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-primary font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Email</label>
                  <input 
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-primary font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Role</label>
                  <select 
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
                    className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-primary font-bold appearance-none"
                  >
                    <option value="student">Student</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddingUser(false)}
                    className="flex-1 py-4 bg-gray-100 text-[#1b2559] rounded-2xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
                  >
                    Create User
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Add/Edit Test Modal */}
        {(isAddingTest || editingTest) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black">{isAddingTest ? 'Create New Test' : 'Edit Test'}</h3>
                <button onClick={() => { setIsAddingTest(false); setEditingTest(null); }} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={isAddingTest ? handleCreateTest : handleUpdateTest} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Test Title</label>
                  <input 
                    type="text"
                    required
                    value={isAddingTest ? newTest.title : editingTest?.title}
                    onChange={(e) => isAddingTest ? setNewTest({...newTest, title: e.target.value}) : setEditingTest({...editingTest!, title: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-primary font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Description</label>
                  <textarea 
                    required
                    value={isAddingTest ? newTest.description : editingTest?.description}
                    onChange={(e) => isAddingTest ? setNewTest({...newTest, description: e.target.value}) : setEditingTest({...editingTest!, description: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-primary font-bold resize-none h-24"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Duration (Mins)</label>
                    <input 
                      type="number"
                      required
                      value={isAddingTest ? newTest.durationMinutes : editingTest?.durationMinutes}
                      onChange={(e) => isAddingTest ? setNewTest({...newTest, durationMinutes: parseInt(e.target.value)}) : setEditingTest({...editingTest!, durationMinutes: parseInt(e.target.value)})}
                      className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-primary font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Module</label>
                    <select 
                      value={isAddingTest ? newTest.moduleId : editingTest?.moduleId}
                      onChange={(e) => isAddingTest ? setNewTest({...newTest, moduleId: e.target.value as any}) : setEditingTest({...editingTest!, moduleId: e.target.value as any})}
                      className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-primary font-bold appearance-none"
                    >
                      <option value="aptitude">Aptitude</option>
                      <option value="dsa">DSA</option>
                      <option value="dbms">DBMS</option>
                      <option value="cs-core">CS Core</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => { setIsAddingTest(false); setEditingTest(null); }}
                    className="flex-1 py-4 bg-gray-100 text-[#1b2559] rounded-2xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
                  >
                    {isAddingTest ? 'Create Test' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {/* Add/Edit Question Modal */}
        {(isAddingQuestionTo || editingQuestion) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black">{isAddingQuestionTo ? 'Add New Question' : 'Edit Question'}</h3>
                <button onClick={() => { setIsAddingQuestionTo(null); setEditingQuestion(null); }} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={isAddingQuestionTo ? handleAddQuestion : handleUpdateQuestion} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Question Text</label>
                  <textarea 
                    required
                    value={isAddingQuestionTo ? newQuestion.text : editingQuestion?.question.text}
                    onChange={(e) => isAddingQuestionTo ? setNewQuestion({...newQuestion, text: e.target.value}) : setEditingQuestion({...editingQuestion!, question: {...editingQuestion!.question, text: e.target.value}})}
                    className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-primary font-bold resize-none h-24"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[0, 1, 2, 3].map((idx) => (
                    <div key={idx}>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Option {idx + 1}</label>
                      <input 
                        type="text"
                        required
                        value={isAddingQuestionTo ? newQuestion.options[idx] : editingQuestion?.question.options[idx]}
                        onChange={(e) => {
                          if (isAddingQuestionTo) {
                            const opts = [...newQuestion.options];
                            opts[idx] = e.target.value;
                            setNewQuestion({...newQuestion, options: opts});
                          } else {
                            const opts = [...editingQuestion!.question.options];
                            opts[idx] = e.target.value;
                            setEditingQuestion({...editingQuestion!, question: {...editingQuestion!.question, options: opts}});
                          }
                        }}
                        className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 outline-none focus:ring-primary font-bold"
                      />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Correct Answer</label>
                    <select 
                      value={isAddingQuestionTo ? newQuestion.correctAnswer : editingQuestion?.question.correctAnswer}
                      onChange={(e) => isAddingQuestionTo ? setNewQuestion({...newQuestion, correctAnswer: parseInt(e.target.value)}) : setEditingQuestion({...editingQuestion!, question: {...editingQuestion!.question, correctAnswer: parseInt(e.target.value)}})}
                      className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-primary font-bold appearance-none"
                    >
                      <option value={0}>Option 1</option>
                      <option value={1}>Option 2</option>
                      <option value={2}>Option 3</option>
                      <option value={3}>Option 4</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Explanation (Optional)</label>
                    <input 
                      type="text"
                      value={isAddingQuestionTo ? newQuestion.explanation : editingQuestion?.question.explanation}
                      onChange={(e) => isAddingQuestionTo ? setNewQuestion({...newQuestion, explanation: e.target.value}) : setEditingQuestion({...editingQuestion!, question: {...editingQuestion!.question, explanation: e.target.value}})}
                      className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 outline-none focus:ring-primary font-bold"
                    />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => { setIsAddingQuestionTo(null); setEditingQuestion(null); }}
                    className="flex-1 py-4 bg-gray-100 text-[#1b2559] rounded-2xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
                  >
                    {isAddingQuestionTo ? 'Add Question' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {replyingTicket && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-[#1b2559]">Reply to Ticket</h3>
                  <p className="text-sm text-gray-400 font-bold">From: {replyingTicket.displayName}</p>
                </div>
                <button onClick={() => setReplyingTicket(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Student Message</p>
                  <p className="text-sm font-bold text-gray-700">{replyingTicket.message}</p>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Your Reply</label>
                  <textarea
                    rows={6}
                    value={adminReplyText}
                    onChange={(e) => setAdminReplyText(e.target.value)}
                    placeholder="Type your response here..."
                    className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-primary rounded-[2rem] outline-none transition-all font-bold text-sm resize-none"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setReplyingTicket(null)}
                    className="flex-1 px-8 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReplyTicket}
                    disabled={isReplying || !adminReplyText}
                    className="flex-[2] px-8 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isReplying ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send size={18} />
                        Send Reply
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </main>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#111c44]/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-gray-100"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-2xl font-black text-[#1b2559] mb-2">{confirmModal.title}</h3>
              <p className="text-gray-500 font-medium mb-8">{confirmModal.message}</p>
              <div className="flex gap-4">
                <button
                  onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                  className="flex-1 px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="flex-1 px-6 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            className={cn(
              "fixed top-24 left-1/2 -translate-x-1/2 z-[200] text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3",
              toast.type === 'success' ? "bg-emerald-600" : "bg-red-600"
            )}
          >
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            </div>
            <div>
              <p className="font-bold text-sm">{toast.message}</p>
            </div>
            <button onClick={() => setToast(prev => ({ ...prev, show: false }))} className="ml-4 p-1 hover:bg-white/10 rounded-lg transition-all">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
