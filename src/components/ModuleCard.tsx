import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import { ModuleId } from '@/src/types';

export interface ModuleCardProps {
  id: ModuleId;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  topics: string[];
  key?: React.Key;
}

export const ModuleCard: React.FC<ModuleCardProps> = ({ id, title, description, icon: Icon, color, topics }) => {
  const navigate = useNavigate();

  const handleTakeTest = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen request failed:", err);
    } finally {
      navigate(`/test/${id}`);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-100 border border-gray-100 flex flex-col h-full"
    >
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6", color)}>
        <Icon size={28} className="text-white" />
      </div>
      
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm mb-6 flex-grow">{description}</p>
      
      <div className="space-y-2 mb-8">
        {topics.slice(0, 3).map((topic, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-1 h-1 rounded-full bg-gray-300" />
            {topic}
          </div>
        ))}
        {topics.length > 3 && (
          <p className="text-xs text-primary font-medium">+{topics.length - 3} more topics</p>
        )}
      </div>
      
      <div className="flex gap-3">
        <Link
          to={`/modules/${id}`}
          className="flex-1 bg-gray-50 text-gray-700 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-100 transition-colors text-center"
        >
          Learn
        </Link>
        <button
          onClick={handleTakeTest}
          className={cn(
            "flex-1 py-2.5 rounded-xl font-medium text-sm text-white text-center flex items-center justify-center gap-2 transition-opacity hover:opacity-90",
            color.replace('bg-', 'bg-').split(' ')[0]
          )}
        >
          Take Test
          <ArrowRight size={16} />
        </button>
      </div>
    </motion.div>
  );
}
