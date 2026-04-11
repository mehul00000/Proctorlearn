import { useState, useEffect, useMemo, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Code, Database, Terminal, Trophy, Clock, Target, ArrowRight, Shield, Sparkles, MessageSquare, Send, CheckCircle2, X, History } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/src/components/Navbar';
import { ModuleCard } from '@/src/components/ModuleCard';
import { ModuleId, TestResult, SupportTicket } from '@/src/types';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/context/AuthContext';
import { db } from '@/src/firebase';

const modules = [
  {
    id: 'aptitude' as ModuleId,
    title: "Aptitude & Reasoning",
    description: "Prepare for placement exams with Quantitative, Logical, and Verbal ability modules.",
    icon: Brain,
    color: "bg-orange-500 shadow-orange-200",
    topics: ["Quantitative Aptitude", "Logical Reasoning", "Verbal Ability", "Data Interpretation"]
  },
  {
    id: 'dsa' as ModuleId,
    title: "DSA & Algorithms",
    description: "Master the core data structures and algorithms required for top-tier tech interviews.",
    icon: Code,
    color: "bg-blue-500 shadow-blue-200",
    topics: ["Arrays & Strings", "Linked Lists", "Trees & Graphs", "Dynamic Programming"]
  },
  {
    id: 'dbms' as ModuleId,
    title: "DBMS & SQL",
    description: "Learn database design, normalization, and complex SQL queries for real-world applications.",
    icon: Database,
    color: "bg-emerald-500 shadow-emerald-200",
    topics: ["ER Modeling", "Normalization", "SQL Queries", "Transactions"]
  },
  {
    id: 'cs-core' as ModuleId,
    title: "Programming & Core CS",
    description: "Build strong fundamentals in OOPs, Operating Systems, and Computer Networks.",
    icon: Terminal,
    color: "bg-indigo-500 shadow-primary/20",
    topics: ["OOP Concepts", "Operating Systems", "Computer Networks", "C++/Java/Python"]
  }
];

export default function Dashboard() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState<TestResult[]>([]);
  const [allResults, setAllResults] = useState<TestResult[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Redirect admin to admin dashboard
  useEffect(() => {
    if (!authLoading && profile) {
      if (profile.role === 'admin' || profile.email === 'mehulsharma31253@gmail.com') {
        navigate('/admin');
      }
    }
  }, [profile, authLoading, navigate]);

  // Listen to user's results
  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'results'),
      where('userId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedResults = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TestResult[];
      
      // Sort client-side to avoid index requirement
      fetchedResults.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      
      setResults(fetchedResults);
      setLoading(false);
    }, (error) => {
      console.error("Results fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  // Listen to ALL results for real-time ranking
  useEffect(() => {
    if (!profile) return;

    const q = query(collection(db, 'results'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedAllResults = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TestResult[];
      setAllResults(fetchedAllResults);
    }, (error) => {
      console.error("All results fetch error:", error);
    });

    return () => unsubscribe();
  }, [profile]);

  // Listen to user's support tickets
  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'support_tickets'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTickets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SupportTicket[];
      setSupportTickets(fetchedTickets);
    }, (error) => {
      console.error("Support tickets fetch error:", error);
    });

    return () => unsubscribe();
  }, [profile]);

  const avgScore = results.length > 0 
    ? Math.round((results.reduce((acc, r) => acc + (r.totalQuestions > 0 ? r.score / r.totalQuestions : 0), 0) / results.length) * 100)
    : 0;

  // Calculate Rank
  const calculateRank = () => {
    if (!profile || allResults.length === 0) return "N/A";

    // Group results by user and calculate total score
    const userScores: Record<string, number> = {};
    allResults.forEach(res => {
      userScores[res.userId] = (userScores[res.userId] || 0) + res.score;
    });

    // Convert to array and sort
    const sortedUsers = Object.entries(userScores)
      .map(([userId, totalScore]) => ({ userId, totalScore }))
      .sort((a, b) => b.totalScore - a.totalScore);

    // Find current user's rank
    const rank = sortedUsers.findIndex(u => u.userId === profile.uid) + 1;
    return rank > 0 ? `#${rank}` : "N/A";
  };

  const currentRank = calculateRank();

  // Recommendation Logic
  const recommendation = useMemo(() => {
    if (results.length === 0) {
      return {
        module: modules[0],
        message: "Welcome! Start your journey with Aptitude & Reasoning, the foundation of all placements."
      };
    }

    // Calculate stats per module
    const moduleStats = modules.map(m => {
      const moduleResults = results.filter(r => r.moduleId === m.id);
      const avg = moduleResults.length > 0
        ? moduleResults.reduce((acc, r) => acc + (r.totalQuestions > 0 ? r.score / r.totalQuestions : 0), 0) / moduleResults.length
        : -1; // -1 means never attempted
      return { id: m.id, avg, count: moduleResults.length, module: m };
    });

    // Priority 1: Never attempted modules
    const neverAttempted = moduleStats.filter(s => s.avg === -1);
    if (neverAttempted.length > 0) {
      const target = neverAttempted[0];
      return {
        module: target.module,
        message: `You haven't tried ${target.module.title} yet. Explore new topics to broaden your skills!`
      };
    }

    // Priority 2: Lowest average score
    const sortedByScore = [...moduleStats].sort((a, b) => a.avg - b.avg);
    const weakest = sortedByScore[0];
    
    if (weakest.avg < 0.7) {
      return {
        module: weakest.module,
        message: `Your performance in ${weakest.module.title} could use some improvement. Let's practice more!`
      };
    }

    // Priority 3: Least attempted (if all scores are good)
    const sortedByCount = [...moduleStats].sort((a, b) => a.count - b.count);
    const leastAttempted = sortedByCount[0];
    return {
      module: leastAttempted.module,
      message: `You're doing great! Why not revisit ${leastAttempted.module.title} to maintain your edge?`
    };
  }, [results]);

  const handleStartRecommended = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen request failed:", err);
    } finally {
      navigate(`/test/${recommendation.module.id}`);
    }
  };

  const markTicketAsRead = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'support_tickets', ticketId), {
        isReadByStudent: true
      });
    } catch (err) {
      console.error("Error marking ticket as read:", err);
    }
  };

  const handleSubmitTicket = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !ticketSubject || !ticketMessage || isSubmittingTicket) return;

    setIsSubmittingTicket(true);
    try {
      await addDoc(collection(db, 'support_tickets'), {
        userId: profile.uid,
        userEmail: profile.email,
        displayName: profile.displayName,
        subject: ticketSubject,
        message: ticketMessage,
        status: 'open',
        createdAt: new Date().toISOString(),
        isReadByAdmin: false
      });
      setTicketSuccess(true);
      setTicketSubject('');
      setTicketMessage('');
      
      // Show success in modal for 1.5s then close and show toast
      setTimeout(() => {
        setTicketSuccess(false);
        setShowContactModal(false);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
      }, 1500);
    } catch (err) {
      console.error("Error submitting ticket:", err);
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Welcome Header */}
        <header className="mb-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, {profile?.displayName}! 👋</h1>
            <p className="text-gray-600">Ready to level up your skills today? Choose a module to get started.</p>
          </motion.div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            { label: "Tests Completed", value: results.length.toString(), icon: Trophy, color: "text-amber-500", bg: "bg-amber-50" },
            { label: "Avg. Score", value: `${avgScore}%`, icon: Target, color: "text-emerald-500", bg: "bg-emerald-50" },
            { label: "Violations", value: results.reduce((acc, r) => acc + r.proctoringEvents.length, 0).toString(), icon: Shield, color: "text-red-500", bg: "bg-red-50" },
            { label: "Current Rank", value: currentRank, icon: Trophy, color: "text-primary", bg: "bg-primary/5" }
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4"
            >
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", stat.bg)}>
                <stat.icon className={stat.color} size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Modules Grid */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Learning Modules</h2>
            <button className="text-primary font-semibold text-sm hover:underline flex items-center gap-1">
              View All <ArrowRight size={16} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {modules.map((module) => (
              <ModuleCard
                key={module.id}
                id={module.id}
                title={module.title}
                description={module.description}
                icon={module.icon}
                color={module.color}
                topics={module.topics}
              />
            ))}
          </div>
        </div>

        {/* Recent Activity / Recommendations */}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold mb-6">Recent Performance</h3>
            {results.length > 0 ? (
              <div className="space-y-4">
                {results.slice(0, 5).map((res) => (
                    <div key={res.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                          (res.totalQuestions - res.score) >= 2 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                        )}>
                          {(res.totalQuestions - res.score) >= 2 ? <X size={20} /> : <CheckCircle2 size={20} />}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{res.moduleId.toUpperCase()} Test</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-gray-500">{new Date(res.completedAt).toLocaleDateString()}</p>
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                              (res.totalQuestions - res.score) >= 2 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                            )}>
                              {(res.totalQuestions - res.score) >= 2 ? 'Failed' : 'Passed'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{res.score} / {res.totalQuestions}</p>
                        <p className="text-xs text-gray-400">Score</p>
                      </div>
                    </div>
                ))}
              </div>
            ) : (
              <div className="h-64 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 italic">
                No tests completed yet. Start your first test!
              </div>
            )}
          </div>
          
          <div className="bg-primary rounded-3xl p-8 text-white shadow-xl shadow-primary/20 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles size={20} />
              </div>
              <h3 className="text-xl font-bold">Recommended for You</h3>
            </div>
            
            <p className="text-primary-foreground/80 text-sm mb-8 leading-relaxed flex-grow">
              {recommendation.message}
            </p>

            <div className="bg-white/10 rounded-2xl p-4 mb-8 border border-white/10">
              <p className="text-xs font-bold text-primary-foreground/60 uppercase tracking-wider mb-2">Target Module</p>
              <div className="flex items-center gap-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", recommendation.module.color)}>
                  <recommendation.module.icon size={16} className="text-white" />
                </div>
                <p className="font-bold">{recommendation.module.title}</p>
              </div>
            </div>

            <button 
              onClick={handleStartRecommended}
              className="w-full bg-white text-primary py-4 rounded-2xl font-bold hover:bg-primary/5 transition-all shadow-lg active:scale-[0.98]"
            >
              Start Recommended Test
            </button>
          </div>
        </div>

        {/* Support History Section */}
        <div className="mt-12 bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center text-primary">
                <History size={20} />
              </div>
              <h3 className="text-xl font-bold">Support History</h3>
            </div>
            <button 
              onClick={() => setShowContactModal(true)}
              className="text-primary font-bold text-sm hover:underline"
            >
              New Ticket
            </button>
          </div>

          {supportTickets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {supportTickets.map((ticket) => (
                <div 
                  key={ticket.id} 
                  onClick={() => {
                    setSelectedTicket(ticket);
                    if (ticket.status === 'replied' && !ticket.isReadByStudent) {
                      markTicketAsRead(ticket.id);
                    }
                  }}
                  className={cn(
                    "p-5 rounded-2xl border transition-all cursor-pointer group relative",
                    ticket.status === 'replied' && !ticket.isReadByStudent
                      ? "bg-primary/5 border-primary/20 shadow-md shadow-primary/5"
                      : "bg-gray-50 border-gray-100 hover:border-primary/30"
                  )}
                >
                  {ticket.status === 'replied' && !ticket.isReadByStudent && (
                    <span className="absolute top-4 right-4 w-2 h-2 bg-primary rounded-full animate-pulse" />
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                        ticket.status === 'open' ? "bg-amber-100 text-amber-700" : 
                        ticket.status === 'replied' ? "bg-emerald-100 text-emerald-700" : 
                        "bg-gray-200 text-gray-600"
                      )}>
                        {ticket.status}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <h4 className="font-bold text-gray-900 mb-1 group-hover:text-primary transition-colors">{ticket.subject}</h4>
                  <p className="text-xs text-gray-500 line-clamp-1 mb-3">{ticket.message}</p>
                  
                  {ticket.adminReply && (
                    <div className="mt-3 pt-3 border-t border-gray-200/50">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Admin Reply</p>
                      <p className="text-xs text-gray-600 italic line-clamp-1">"{ticket.adminReply}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <MessageSquare size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No support tickets found.</p>
              <button 
                onClick={() => setShowContactModal(true)}
                className="mt-4 text-primary font-bold text-sm hover:underline"
              >
                Create your first ticket
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Contact Us Floating Button */}
      <button
        onClick={() => setShowContactModal(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-primary-hover transition-all hover:scale-110 z-40 group"
      >
        <MessageSquare size={28} />
        <span className="absolute right-full mr-4 px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Contact Support
        </span>
      </button>

      {/* Ticket Details Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center text-primary">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900">Ticket Details</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      ID: {selectedTicket.id.substring(0, 8)}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedTicket(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Your Message</p>
                    <span className="text-[10px] font-bold text-gray-400">
                      {new Date(selectedTicket.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-900 mb-2">{selectedTicket.subject}</h4>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{selectedTicket.message}</p>
                </div>

                {selectedTicket.adminReply ? (
                  <div className="bg-primary/5 rounded-2xl p-5 border border-primary/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                      <Shield size={64} />
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-black text-primary uppercase tracking-widest">Admin Response</p>
                      <span className="text-[10px] font-bold text-primary/60">
                        {selectedTicket.repliedAt ? new Date(selectedTicket.repliedAt).toLocaleString() : 'Recently'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-medium">
                      {selectedTicket.adminReply}
                    </p>
                  </div>
                ) : (
                  <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 flex items-center gap-3 text-amber-700">
                    <Clock size={20} className="shrink-0" />
                    <p className="text-xs font-bold">Waiting for admin response. We usually reply within 24 hours.</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedTicket(null)}
                className="w-full mt-8 bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all"
              >
                Close Details
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Contact Us Modal */}
      <AnimatePresence>
        {showContactModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-2xl" />
              
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center text-primary">
                      <MessageSquare size={20} />
                    </div>
                    <h3 className="text-xl font-black text-gray-900">Contact Us</h3>
                  </div>
                  <button onClick={() => setShowContactModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                    <X size={20} />
                  </button>
                </div>

                {ticketSuccess ? (
                  <div className="py-12 text-center">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={32} />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-2">Message Sent!</h4>
                    <p className="text-sm text-gray-500">Our team will get back to you shortly.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitTicket} className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Subject</label>
                      <input
                        type="text"
                        required
                        value={ticketSubject}
                        onChange={(e) => setTicketSubject(e.target.value)}
                        placeholder="What's the issue?"
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-primary rounded-2xl outline-none transition-all font-bold text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Message</label>
                      <textarea
                        required
                        rows={4}
                        value={ticketMessage}
                        onChange={(e) => setTicketMessage(e.target.value)}
                        placeholder="Describe your problem in detail..."
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-primary rounded-2xl outline-none transition-all font-bold text-sm resize-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmittingTicket}
                      className="w-full bg-primary text-white py-4 rounded-2xl font-bold hover:bg-primary-hover transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                      {isSubmittingTicket ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send size={18} />
                          Send Message
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] bg-emerald-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <p className="font-bold text-sm">Message Sent Successfully!</p>
              <p className="text-[10px] text-emerald-100 font-medium">Our team will review your request shortly.</p>
            </div>
            <button onClick={() => setShowToast(false)} className="ml-4 p-1 hover:bg-white/10 rounded-lg transition-all">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
