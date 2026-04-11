import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, AlertTriangle, XCircle } from 'lucide-react';
import { ProctoringEvent } from '@/src/types';
import { cn } from '@/src/lib/utils';

interface ProctoringOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isFaceDetected: boolean;
  violations: ProctoringEvent[];
  showWarning: boolean;
  lastViolation: ProctoringEvent | null;
}

export default function ProctoringOverlay({
  videoRef,
  isFaceDetected,
  violations,
  showWarning,
  lastViolation
}: ProctoringOverlayProps) {
  const faceViolations = violations.filter(e => e.type === 'face_missing').length;

  return (
    <>
      {/* Warning Toast */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4"
          >
            <div className="bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 border-2 border-red-500">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="font-bold text-sm uppercase tracking-tight">Proctoring Violation</p>
                <p className="text-xs text-white/80">{lastViolation?.details}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar View */}
      <div className="space-y-6">
        <div className="relative aspect-video lg:aspect-square bg-gray-900 rounded-3xl overflow-hidden shadow-inner group border-2 border-gray-200">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-2 py-1 rounded-full text-[10px] font-bold">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE MONITORING
          </div>
          
          <AnimatePresence>
            {!isFaceDetected && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-red-600/40 backdrop-blur-[2px] flex items-center justify-center text-white text-center p-4"
              >
                <div className="flex flex-col items-center gap-2">
                  <XCircle size={32} />
                  <p className="text-xs font-bold uppercase tracking-widest">Face Not Detected</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Security Status</p>
              <span className={cn(
                "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                isFaceDetected ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
              )}>
                {isFaceDetected ? "Face Detected" : "Face Missing"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", isFaceDetected ? "bg-emerald-500" : "bg-red-500 animate-pulse")} />
              <p className="text-sm font-medium text-gray-700">AI Guardian Active</p>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Face Violations</p>
              <span className={cn("text-[10px] font-bold uppercase", faceViolations > 0 ? "text-red-500" : "text-gray-400")}>
                {faceViolations} / 5
              </span>
            </div>
            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-red-500"
                initial={{ width: 0 }}
                animate={{ width: `${(faceViolations / 5) * 100}%` }}
              />
            </div>
            {faceViolations >= 3 && (
              <p className="text-[10px] text-red-500 font-bold mt-2 uppercase tracking-tight">
                Warning: Too many face violations. Test will auto-submit at 6.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
