import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Brain, Code, Database, Terminal, ArrowLeft, BookOpen, CheckCircle2, Play } from 'lucide-react';
import Navbar from '@/src/components/Navbar';
import { ModuleId } from '@/src/types';
import { cn } from '@/src/lib/utils';

const moduleData: Record<ModuleId, {
  title: string;
  icon: any;
  color: string;
  sections: { title: string; content: string[] }[];
}> = {
  'aptitude': {
    title: "Aptitude & Reasoning",
    icon: Brain,
    color: "bg-orange-500",
    sections: [
      { title: "Quantitative Aptitude", content: ["Numbers & Algebra", "Probability", "Permutations & Combinations", "Data Interpretation"] },
      { title: "Logical Reasoning", content: ["Puzzles", "Seating Arrangement", "Series & Patterns", "Syllogisms"] },
      { title: "Verbal Ability", content: ["Grammar", "Reading Comprehension", "Vocabulary"] }
    ]
  },
  'dsa': {
    title: "DSA & Algorithms",
    icon: Code,
    color: "bg-blue-500",
    sections: [
      { title: "Basics", content: ["Arrays", "Strings"] },
      { title: "Data Structures", content: ["Linked Lists", "Stacks & Queues", "Trees & Graphs", "Hashing"] },
      { title: "Algorithms", content: ["Binary Search", "Quick & Merge Sort", "Dynamic Programming"] }
    ]
  },
  'dbms': {
    title: "DBMS & SQL",
    icon: Database,
    color: "bg-emerald-500",
    sections: [
      { title: "Design", content: ["ER Model", "Normalization"] },
      { title: "SQL Queries", content: ["Joins", "Subqueries", "Aggregations"] },
      { title: "Advanced", content: ["Transactions", "Indexing", "Keys"] }
    ]
  },
  'cs-core': {
    title: "Programming & Core CS",
    icon: Terminal,
    color: "bg-indigo-500",
    sections: [
      { title: "Programming", content: ["C++ / Java / Python", "OOP Concepts"] },
      { title: "Operating Systems", content: ["Processes", "Deadlocks", "Scheduling"] },
      { title: "Computer Networks", content: ["OSI Model", "Basics of Communication"] }
    ]
  }
};

export default function ModuleContent() {
  const { moduleId } = useParams<{ moduleId: ModuleId }>();
  const navigate = useNavigate();
  const data = moduleData[moduleId as ModuleId];

  if (!data) return <div>Module not found</div>;

  const Icon = data.icon;

  const handleStartTest = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen request failed:", err);
    } finally {
      navigate(`/test/${moduleId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <Navbar />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-primary font-bold mb-8 transition-colors group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </Link>

        <header className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-gray-100 mb-12 flex flex-col md:flex-row items-center gap-8">
          <div className={cn("w-24 h-24 rounded-3xl flex items-center justify-center shrink-0 shadow-xl", data.color)}>
            <Icon size={48} className="text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-gray-900 mb-4">{data.title}</h1>
            <p className="text-gray-600 text-lg leading-relaxed">
              Master the core concepts of {data.title} with our structured curriculum designed for placement success.
            </p>
          </div>
        </header>

        <div className="space-y-8">
          {data.sections.map((section, i) => (
            <motion.section
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                  <BookOpen size={20} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{section.title}</h2>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {section.content.map((item, j) => (
                  <div key={j} className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-primary/20 transition-all">
                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-emerald-500 shadow-sm">
                      <CheckCircle2 size={16} />
                    </div>
                    <span className="font-medium text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </motion.section>
          ))}
        </div>

        <div className="mt-12 text-center">
          <button
            onClick={handleStartTest}
            className={cn(
              "inline-flex items-center gap-3 px-12 py-5 rounded-2xl font-black text-xl text-white shadow-xl hover:opacity-90 transition-all",
              data.color
            )}
          >
            Start Practice Test
            <Play size={24} />
          </button>
        </div>
      </main>
    </div>
  );
}
