/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import TestSession from './pages/TestSession';
import AdminDashboard from './pages/AdminDashboard';
import ModuleContent from './pages/ModuleContent';
import ResultAnalysis from './pages/ResultAnalysis';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';

const PrivateRoute = ({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) => {
  const { user, profile, loading, isAuthReady } = useAuth();
  
  if (!isAuthReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" replace />;
  
  const isOtpVerified = sessionStorage.getItem('otp_verified') === 'true';
  if (!isOtpVerified) return <Navigate to="/login" replace />;
  
  const isAdmin = profile?.role === 'admin' || user.email === 'mehulsharma31253@gmail.com';
  
  // If admin tries to access student dashboard, send to admin panel
  if (!adminOnly && isAdmin && window.location.pathname === '/dashboard') {
    return <Navigate to="/admin" replace />;
  }
  
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/modules/:moduleId" element={<PrivateRoute><ModuleContent /></PrivateRoute>} />
            <Route path="/test/:moduleId" element={<PrivateRoute><TestSession /></PrivateRoute>} />
            <Route path="/analysis/:moduleId" element={<PrivateRoute><ResultAnalysis /></PrivateRoute>} />
            <Route path="/admin" element={<PrivateRoute adminOnly><AdminDashboard /></PrivateRoute>} />
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </SettingsProvider>
    </AuthProvider>
  );
}





