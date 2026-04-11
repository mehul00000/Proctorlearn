import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, BookOpen, LayoutDashboard, Settings, LogOut, Bell, MessageSquare, X } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { useSettings } from '@/src/context/SettingsContext';
import { logout, db } from '@/src/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { SupportTicket } from '@/src/types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';

export default function Navbar() {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const [unreadTickets, setUnreadTickets] = useState<SupportTicket[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.email === 'mehulsharma31253@gmail.com';
  const dashboardPath = isAdmin ? '/admin' : '/dashboard';

  useEffect(() => {
    if (!profile || isAdmin) return;

    const q = query(
      collection(db, 'support_tickets'),
      where('userId', '==', profile.uid),
      where('status', '==', 'replied'),
      where('isReadByStudent', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tickets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SupportTicket[];
      setUnreadTickets(tickets);
    });

    return () => unsubscribe();
  }, [profile, isAdmin]);

  const markAsRead = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'support_tickets', ticketId), {
        isReadByStudent: true
      });
    } catch (err) {
      console.error("Error marking ticket as read:", err);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <Shield size={24} />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-hover">
              {settings?.branding?.siteName || 'ProctorLearn AI'}
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link to={dashboardPath} className="text-gray-600 hover:text-primary font-medium transition-colors flex items-center gap-1">
              <LayoutDashboard size={18} />
              Dashboard
            </Link>
            <Link to={dashboardPath} className="text-gray-600 hover:text-primary font-medium transition-colors flex items-center gap-1">
              <BookOpen size={18} />
              Modules
            </Link>
            {isAdmin && (
              <Link to="/admin" className="text-gray-600 hover:text-primary font-medium transition-colors flex items-center gap-1">
                <Settings size={18} />
                Admin
              </Link>
            )}
          </div>

          <div className="flex items-center gap-4">
            {profile && !isAdmin && (
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 text-gray-500 hover:text-primary hover:bg-primary/5 rounded-full transition-all relative"
                >
                  <Bell size={20} />
                  {unreadTickets.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                      {unreadTickets.length}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {showNotifications && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[60]"
                    >
                      <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                        <h3 className="font-bold text-sm text-gray-900">Notifications</h3>
                        <div className="flex items-center gap-2">
                          {unreadTickets.length > 0 && (
                            <button 
                              onClick={async () => {
                                for (const ticket of unreadTickets) {
                                  await markAsRead(ticket.id);
                                }
                              }}
                              className="text-[10px] font-bold text-primary hover:underline"
                            >
                              Clear All
                            </button>
                          )}
                          <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600">
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {unreadTickets.length > 0 ? (
                          unreadTickets.map((ticket) => (
                            <div key={ticket.id} className="p-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                              <div className="flex gap-3">
                                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
                                  <MessageSquare size={16} />
                                </div>
                                <div className="flex-grow">
                                  <p className="text-xs font-bold text-gray-900 mb-1">Admin replied to: {ticket.subject}</p>
                                  <p className="text-[11px] text-gray-500 line-clamp-2 mb-2 italic">"{ticket.adminReply}"</p>
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => markAsRead(ticket.id)}
                                      className="text-[10px] font-bold text-primary hover:underline"
                                    >
                                      Mark as read
                                    </button>
                                    <Link 
                                      to="/dashboard" 
                                      onClick={() => setShowNotifications(false)}
                                      className="text-[10px] font-bold text-gray-400 hover:text-gray-600 hover:underline"
                                    >
                                      View Details
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-8 text-center">
                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300">
                              <Bell size={24} />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">No new notifications</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {profile ? (
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-gray-900">{profile.displayName}</p>
                  <p className="text-xs text-gray-500 capitalize">{profile.role}</p>
                </div>
                <button
                  onClick={() => logout()}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="bg-primary text-white px-6 py-2 rounded-full font-medium hover:bg-primary-hover transition-all shadow-md shadow-primary/10"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

