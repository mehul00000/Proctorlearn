export type ModuleId = 'aptitude' | 'dsa' | 'dbms' | 'cs-core';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'student' | 'admin';
  createdAt: string;
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface Test {
  id: string;
  moduleId: ModuleId;
  title: string;
  description: string;
  durationMinutes: number;
  questions: Question[];
}

export interface ProctoringEvent {
  timestamp: number;
  type: 'face_missing' | 'multiple_faces' | 'tab_switch' | 'face_missing_timeout';
  details?: string;
}

export interface TestResult {
  id: string;
  userId: string;
  moduleId: ModuleId;
  score: number;
  totalQuestions: number;
  completedAt: string;
  proctoringEvents: ProctoringEvent[];
  questionIds: string[];
  submissionReason?: string;
}

export interface LiveSession {
  id: string;
  userId: string;
  userEmail: string;
  displayName: string;
  moduleId: ModuleId;
  startTime: string;
  lastHeartbeat: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  score: number;
  proctoringStatus: 'safe' | 'warning' | 'critical';
  isFaceDetected: boolean;
  violationCount: number;
  latestViolation?: ProctoringEvent;
  remoteCommand?: 'submit' | 'cancel' | null;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  displayName: string;
  subject: string;
  message: string;
  status: 'open' | 'replied' | 'closed';
  createdAt: string;
  adminReply?: string;
  repliedAt?: string;
  isReadByAdmin: boolean;
  isReadByStudent?: boolean;
}

export interface SystemSettings {
  id: string;
  proctoring: {
    faceMissingTimeout: number; // in seconds
    maxTabSwitches: number;
    enableFaceDetection: boolean;
    enableTabSwitchDetection: boolean;
    enableMultipleFacesDetection: boolean;
  };
  notifications: {
    emailAlertsEnabled: boolean;
    dailySummaryEnabled: boolean;
    newUserAlertsEnabled: boolean;
  };
  branding: {
    siteName: string;
    primaryColor: string;
  };
  updatedAt: string;
}
