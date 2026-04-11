import { motion } from 'motion/react';
import { Shield, BookOpen, Brain, Code, Database, Terminal, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '@/src/components/Navbar';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/context/AuthContext';
import { useSettings } from '@/src/context/SettingsContext';

export default function LandingPage() {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const isAdmin = profile?.role === 'admin' || profile?.email === 'mehulsharma31253@gmail.com';
  const dashboardPath = isAdmin ? '/admin' : '/dashboard';

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-primary/10 selection:text-primary">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] opacity-60 animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] opacity-60 animate-pulse" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 text-primary text-sm font-semibold mb-8 border border-primary/10"
          >
            <Shield size={16} />
            <span>AI-Powered Proctoring System</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-8 leading-[0.9]"
          >
            Master Your <span className="text-primary">Placements</span> <br />
            with <span className="italic font-serif">Confidence.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-2xl mx-auto text-lg md:text-xl text-gray-600 mb-12 leading-relaxed"
          >
            The ultimate platform for students to learn, practice, and excel in 
            Aptitude, DSA, DBMS, and Core CS with real-time AI proctoring.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              to={dashboardPath}
              className="w-full sm:w-auto px-8 py-4 bg-primary text-white rounded-2xl font-bold text-lg hover:bg-primary-hover transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2 group"
            >
              Get Started Now
              <ArrowRight className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/about"
              className="w-full sm:w-auto px-8 py-4 bg-white text-gray-900 border border-gray-200 rounded-2xl font-bold text-lg hover:bg-gray-50 transition-all"
            >
              Learn More
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Core Learning Modules</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Everything you need to crack top-tier tech placements, all in one place.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                title: "Aptitude & Reasoning",
                icon: Brain,
                color: "bg-orange-500",
                desc: "Quantitative, Logical, and Verbal ability for TCS, Infosys, and more."
              },
              {
                title: "DSA & Algorithms",
                icon: Code,
                color: "bg-blue-500",
                desc: "Master Arrays, Trees, Graphs, and Dynamic Programming for interviews."
              },
              {
                title: "DBMS & SQL",
                icon: Database,
                color: "bg-emerald-500",
                desc: "ER Models, Normalization, and complex SQL queries for real-world data."
              },
              {
                title: "Programming & Core CS",
                icon: Terminal,
                color: "bg-indigo-500",
                desc: "C++/Java/Python, OOPs, OS, and Networking fundamentals."
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -5 }}
                className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100"
              >
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6", feature.color)}>
                  <feature.icon className="text-white" size={24} />
                </div>
                <h3 className="text-xl font-bold mb-4">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Proctoring Section */}
      <section className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 text-red-700 text-sm font-semibold mb-6 border border-red-100">
                <Shield size={16} />
                <span>Deeptech Proctoring</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">
                Secure Exams with <br />
                <span className="text-primary">AI-Powered Monitoring</span>
              </h2>
              <p className="text-gray-600 text-lg mb-10 leading-relaxed">
                Our advanced proctoring system ensures the integrity of every test. 
                Focus on your performance while we handle the security.
              </p>
              
              <div className="space-y-4">
                {[
                  "Real-time Face Detection & Monitoring",
                  "Tab Switching & Screen Activity Tracking",
                  "Automated Warning & Logging System",
                  "Live Admin Monitoring Dashboard"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <CheckCircle2 size={16} />
                    </div>
                    <span className="font-medium text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative">
              <div className="aspect-video bg-gray-900 rounded-[2rem] overflow-hidden shadow-2xl relative group">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <img 
                  src="https://picsum.photos/seed/proctor/1200/800" 
                  alt="Proctoring System" 
                  className="w-full h-full object-cover opacity-80"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-6 left-6 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-white" />
                  LIVE PROCTORING ACTIVE
                </div>
                
                <div className="absolute bottom-6 left-6 right-6 p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                        <Shield size={20} />
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">AI Guardian</p>
                        <p className="text-white/60 text-xs">Monitoring active...</p>
                      </div>
                    </div>
                    <div className="text-emerald-400 text-xs font-bold">SECURE</div>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-indigo-500"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-violet-600/10 rounded-full blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
              <Shield size={18} />
            </div>
            <span className="text-lg font-bold">{settings?.branding?.siteName || 'ProctorLearn AI'}</span>
          </div>
          <p className="text-gray-500 text-sm font-medium">
            © 2026 {settings?.branding?.siteName || 'ProctorLearn AI'}. Built for the future of education.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-gray-400 hover:text-primary transition-colors">Privacy</a>
            <a href="#" className="text-gray-400 hover:text-primary transition-colors">Terms</a>
            <a href="#" className="text-gray-400 hover:text-primary transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
