import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Brain, Code, Database, Terminal, ArrowLeft, Shield, AlertTriangle, CheckCircle2, BarChart3, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import Navbar from '@/src/components/Navbar';
import { ModuleId, TestResult } from '@/src/types';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/context/AuthContext';
import { db } from '@/src/firebase';
import { format } from 'date-fns';

const mockData = {
  score: 8,
  total: 10,
  timeTaken: "8:45",
  violations: [
    { type: 'Tab Switch', count: 1, time: '2:30' },
    { type: 'Face Missing', count: 1, time: '5:12' }
  ],
  topicPerformance: [
    { name: 'Logic', score: 90 },
    { name: 'Math', score: 75 },
    { name: 'Verbal', score: 85 },
    { name: 'Data', score: 60 }
  ]
};

export default function ResultAnalysis() {
  const { moduleId } = useParams<{ moduleId: ModuleId }>();
  const { profile } = useAuth();
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!profile || !moduleId) return;

    const q = query(
      collection(db, 'results'),
      where('userId', '==', profile.uid),
      where('moduleId', '==', moduleId),
      orderBy('completedAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setResult(snapshot.docs[0].data() as TestResult);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile, moduleId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 flex flex-col items-center">
        <Navbar />
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No results found</h2>
          <Link to="/dashboard" className="text-primary font-bold hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444'];
  const wrongAnswers = result.totalQuestions - result.score;
  const isFailed = wrongAnswers >= 2;

  const topicPerformance = [
    { name: 'Accuracy', score: result.totalQuestions > 0 ? Math.round((result.score / result.totalQuestions) * 100) : 0 },
    { name: 'Integrity', score: Math.max(0, 100 - (result.proctoringEvents.length * 10)) },
    { name: 'Pass Status', score: isFailed ? 0 : 100 }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-primary font-bold mb-8 transition-colors group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </Link>

        <header className="mb-12">
          <h1 className="text-4xl font-black text-gray-900 mb-2">Performance Analysis</h1>
          <p className="text-gray-600">Detailed breakdown of your {moduleId?.toUpperCase()} test performance and proctoring logs.</p>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Score Card */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-gray-100 grid md:grid-cols-2 gap-12 items-center">
              <div className="text-center md:text-left">
                <div className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6 border",
                  isFailed 
                    ? "bg-red-50 text-red-700 border-red-100" 
                    : "bg-emerald-50 text-emerald-700 border-emerald-100"
                )}>
                  {isFailed ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                  <span>{isFailed ? 'Test Failed' : 'Test Passed'}</span>
                </div>
                <h2 className="text-5xl font-black text-gray-900 mb-4">
                  {isFailed ? 'Keep Pushing!' : 'Great Job!'}
                </h2>
                <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                  {isFailed 
                    ? `You had ${wrongAnswers} incorrect answers. You need to have fewer than 2 wrong answers to pass.`
                    : `You scored higher than 85% of students in this module. Keep it up!`
                  }
                </p>
                <div className="flex gap-4">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Score</p>
                    <p className="text-3xl font-black text-gray-900">{result.score}/{result.totalQuestions}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Date</p>
                    <p className="text-lg font-black text-gray-900">{format(new Date(result.completedAt), 'MMM d, p')}</p>
                  </div>
                </div>
              </div>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Correct', value: result.score },
                        { name: 'Incorrect', value: wrongAnswers }
                      ]}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill={isFailed ? "#ef4444" : "var(--primary-color)"} />
                      <Cell fill="#f1f5f9" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Topic Breakdown */}
            <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                  <BarChart3 size={20} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Performance Metrics</h3>
              </div>
              
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topicPerformance}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} domain={[0, 100]} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="score" fill="var(--primary-color)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Proctoring Report */}
          <div className="space-y-8">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
                  <Shield size={20} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Proctoring Report</h3>
              </div>
              
              <div className="space-y-4">
                {result.proctoringEvents.length > 0 ? (
                  result.proctoringEvents.map((v, i) => (
                    <div key={i} className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-red-600 shrink-0 shadow-sm">
                        <AlertTriangle size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-red-900 text-sm">{v.type.replace('_', ' ').toUpperCase()}</p>
                        <p className="text-red-700 text-xs">{v.details}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center bg-emerald-50 rounded-3xl border border-emerald-100">
                    <CheckCircle2 className="text-emerald-500 mx-auto mb-4" size={32} />
                    <p className="font-bold text-emerald-900">No Violations Detected</p>
                    <p className="text-emerald-700 text-xs mt-1">Perfect integrity score!</p>
                  </div>
                )}
              </div>
              
              <div className="mt-8 pt-8 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Integrity Score</p>
                  <span className="text-xs font-bold text-primary">{topicPerformance[1].score}%</span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${topicPerformance[1].score}%` }}
                    transition={{ duration: 1 }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-primary rounded-[2.5rem] p-8 text-white shadow-xl shadow-primary/20">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-6">
                <TrendingUp size={24} />
              </div>
              <h3 className="text-xl font-bold mb-4">Improvement Tips</h3>
              <ul className="space-y-4 text-primary-foreground/80 text-sm">
                <li className="flex gap-2 italic">
                  <span>•</span>
                  Focus on Data Interpretation to boost your overall score.
                </li>
                <li className="flex gap-2 italic">
                  <span>•</span>
                  Ensure a stable environment to avoid "Face Missing" warnings.
                </li>
                <li className="flex gap-2 italic">
                  <span>•</span>
                  Your logic skills are excellent! Try the advanced module next.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
