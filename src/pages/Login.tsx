import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Mail, Lock, ArrowRight, User, CheckCircle2, AlertCircle } from 'lucide-react';
import Navbar from '@/src/components/Navbar';
import { loginWithEmail, registerWithEmail, signInWithGoogle } from '@/src/firebase';
import { useAuth } from '@/src/context/AuthContext';
import { nanoid } from 'nanoid';

export default function Login() {
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // OTP State
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');

  const [isDemoMode, setIsDemoMode] = useState(false);

  const [resending, setResending] = useState(false);

  const { user, isAuthReady } = useAuth();

  useEffect(() => {
    if (isAuthReady && user) {
      const isOtpVerified = sessionStorage.getItem('otp_verified') === 'true';
      if (!isOtpVerified && !showOtpInput) {
        // Automatically trigger OTP send for already logged in but unverified users
        const code = nanoid(6).toUpperCase();
        setGeneratedOtp(code);
        setEmail(user.email || '');
        sendOtp(user.email || '', code).then(() => {
          setShowOtpInput(true);
        }).catch(err => {
          setError("Failed to send verification code. Please try logging in again.");
        });
      }
    }
  }, [user, isAuthReady, showOtpInput]);

  const sendOtp = async (targetEmail: string, code: string) => {
    try {
      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, otp: code }),
      });
      const data = await response.json();
      if (!response.ok) {
        const errorMsg = data.error || 'Failed to send OTP';
        const errorDetails = data.details ? JSON.stringify(data.details) : '';
        console.error("OTP send error details:", errorDetails);
        throw new Error(errorMsg);
      }
      if (data.isDemoMode) {
        setIsDemoMode(true);
      } else {
        setIsDemoMode(false);
      }
    } catch (err) {
      console.error("OTP send error:", err);
      throw err;
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setError(null);
    try {
      const code = nanoid(6).toUpperCase();
      setGeneratedOtp(code);
      await sendOtp(email, code);
      // Success - maybe show a toast or temporary message
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP');
    } finally {
      setResending(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setIsDemoMode(false);
    
      try {
        if (isRegistering) {
          await registerWithEmail(email, password, displayName);
        } else {
          await loginWithEmail(email, password);
        }
        
        // Generate and send OTP
        const code = nanoid(6).toUpperCase();
        setGeneratedOtp(code);
        await sendOtp(email, code);
        setShowOtpInput(true);
      } catch (err: any) {
        console.error("Auth error:", err);
        if (err.code === 'auth/invalid-credential') {
          setError('Incorrect email or password. If you recently remixed this app, you may need to set up your own Firebase backend via the Settings menu.');
        } else if (err.code === 'auth/email-already-in-use') {
          setError('This email is already registered. Please sign in instead.');
        } else if (err.code === 'auth/weak-password') {
          setError('Password should be at least 6 characters long.');
        } else if (err.code === 'auth/operation-not-allowed') {
          setError('Email/Password sign-in is not enabled in Firebase Console. Please enable it in the Authentication > Sign-in method tab.');
        } else if (err.code === 'auth/unauthorized-domain') {
          setError('This domain is not authorized in Firebase. If you recently remixed this app, please run the Firebase Setup tool in the Settings menu.');
        } else {
          setError(err.message || 'Authentication failed');
        }
      } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // The useEffect will handle sending OTP and showing input
    } catch (err: any) {
      console.error("Google Login error:", err);
      setError(err.message || 'Google Login failed');
      setLoading(false);
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.toUpperCase() === generatedOtp) {
      sessionStorage.setItem('otp_verified', 'true');
      if (email === 'mehulsharma31253@gmail.com') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError('Invalid OTP code. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12 flex flex-col">
      <Navbar />
      
      <main className="flex-grow flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-primary/10 border border-gray-100">
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-primary/20">
                <Shield size={32} />
              </div>
              <h1 className="text-3xl font-black text-gray-900 mb-2">
                {showOtpInput ? 'Verify Email' : (isRegistering ? 'Create Account' : 'Welcome Back')}
              </h1>
              <p className="text-gray-500 font-medium">
                {showOtpInput 
                  ? `We've sent a code to ${email}` 
                  : (isRegistering ? 'Join the future of proctored learning' : 'Sign in to continue your journey')}
              </p>
            </div>

            <AnimatePresence mode="wait">
              {!showOtpInput ? (
                <motion.form 
                  key="auth-form"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleAuth} 
                  className="space-y-6"
                >
                  {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
                      <AlertCircle size={18} />
                      {error}
                    </div>
                  )}

                  {isRegistering && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                          type="text"
                          required
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none font-medium"
                          placeholder="John Doe"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none font-medium"
                        placeholder="name@example.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none font-medium"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-primary/10 hover:bg-primary-hover transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : (isRegistering ? 'Create Account' : 'Sign In')}
                    {!loading && <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />}
                  </button>

                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white text-gray-500 font-bold uppercase tracking-widest text-[10px]">Or continue with</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full bg-white border-2 border-gray-100 text-gray-700 py-4 rounded-2xl font-bold text-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-3 group disabled:opacity-50"
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Google
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setIsRegistering(!isRegistering)}
                      className="text-sm font-bold text-gray-500 hover:text-primary transition-colors"
                    >
                      {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
                    </button>
                  </div>
                </motion.form>
              ) : (
                <motion.form 
                  key="otp-form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onSubmit={handleVerifyOtp}
                  className="space-y-6"
                >
                  {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
                      <AlertCircle size={18} />
                      {error}
                    </div>
                  )}

                  {isDemoMode && (
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700 text-xs font-bold leading-relaxed">
                      <p>⚠️ Resend Testing Restriction: Emails can only be sent to the verified owner of the Resend account.</p>
                      <p className="mt-2">For testing, your code is: <span className="text-lg font-black">{generatedOtp}</span></p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 text-center block">Enter 6-digit Code</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.toUpperCase())}
                      className="w-full px-4 py-6 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none font-black text-3xl text-center tracking-[10px]"
                      placeholder="000000"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-primary text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-primary/10 hover:bg-primary-hover transition-all flex items-center justify-center gap-2 group"
                  >
                    Verify & Continue
                    <CheckCircle2 size={20} />
                  </button>

                  <div className="text-center space-y-4">
                    <button
                      type="button"
                      disabled={resending}
                      onClick={handleResendOtp}
                      className="text-sm font-bold text-primary hover:text-primary-hover transition-colors disabled:opacity-50"
                    >
                      {resending ? 'Sending...' : "Didn't receive a code? Resend"}
                    </button>
                    <br />
                    <button
                      type="button"
                      onClick={() => setShowOtpInput(false)}
                      className="text-sm font-bold text-gray-500 hover:text-primary transition-colors"
                    >
                      Back to Login
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
