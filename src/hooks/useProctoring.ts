import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { ProctoringEvent } from '@/src/types';

interface ProctoringOptions {
  onViolation: (event: ProctoringEvent) => void;
  enabled?: boolean;
  settings?: {
    faceMissingTimeout: number;
    maxTabSwitches: number;
    enableFaceDetection: boolean;
    enableTabSwitchDetection: boolean;
    enableMultipleFacesDetection: boolean;
  };
}

const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

export function useProctoring({ onViolation, enabled = true, settings }: ProctoringOptions) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(true);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load models
  useEffect(() => {
    if (settings && !settings.enableFaceDetection && !settings.enableMultipleFacesDetection) return;
    
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setIsModelsLoaded(true);
        console.log("Face-api models loaded");
      } catch (err) {
        console.error("Error loading face-api models:", err);
      }
    };
    loadModels();
  }, [settings]);

  // Tab switching detection
  useEffect(() => {
    if (!enabled || (settings && !settings.enableTabSwitchDetection)) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        onViolation({
          timestamp: Date.now(),
          type: 'tab_switch',
          details: 'User switched tabs or minimized the window'
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, onViolation, settings]);

  // Camera setup
  const startCamera = useCallback(async () => {
    if (settings && !settings.enableFaceDetection && !settings.enableMultipleFacesDetection) return;
    
    try {
      if (streamRef.current) return; // Already started

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, frameRate: { ideal: 10, max: 15 } },
        audio: false 
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setIsCameraActive(false);
    }
  }, [settings]);

  // Ensure stream is attached to video element when it becomes available
  useEffect(() => {
    const attachStream = () => {
      if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
    };

    // Try immediately
    attachStream();

    // Also set up an interval to check for a few seconds in case of late mounting
    const interval = setInterval(attachStream, 500);
    const timeout = setTimeout(() => clearInterval(interval), 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isCameraActive]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [enabled, startCamera, stopCamera]);

  // Face detection loop
  useEffect(() => {
    if (!enabled || !isCameraActive || !isModelsLoaded || !videoRef.current) return;
    if (settings && !settings.enableFaceDetection && !settings.enableMultipleFacesDetection) return;

    let interval: NodeJS.Timeout;
    let consecutiveMissingSeconds = 0;

    const detect = async () => {
      if (!videoRef.current || !enabled) return;
      
      try {
        const detections = await faceapi.detectAllFaces(
          videoRef.current, 
          new faceapi.TinyFaceDetectorOptions({ 
            inputSize: 320, 
            scoreThreshold: 0.3 
          })
        );

        // Face Missing Detection
        if (settings?.enableFaceDetection) {
          if (detections.length === 0) {
            consecutiveMissingSeconds++;
            setIsFaceDetected(false);
            
            if (consecutiveMissingSeconds >= 3) {
              onViolation({
                timestamp: Date.now(),
                type: 'face_missing',
                details: `Face not detected for ${consecutiveMissingSeconds} seconds.`
              });
            }

            const timeout = settings?.faceMissingTimeout || 8;
            if (consecutiveMissingSeconds >= timeout) {
              onViolation({
                timestamp: Date.now(),
                type: 'face_missing_timeout',
                details: `Face missing for more than ${timeout} seconds. Auto-submitting.`
              });
            }
          } else {
            consecutiveMissingSeconds = 0;
            setIsFaceDetected(true);
          }
        }

        // Multiple Faces Detection
        if (settings?.enableMultipleFacesDetection && detections.length > 1) {
          onViolation({
            timestamp: Date.now(),
            type: 'multiple_faces',
            details: `${detections.length} faces detected. Only one person is allowed.`
          });
        }
      } catch (err) {
        console.error("Detection error:", err);
      }
    };

    interval = setInterval(detect, 1000);

    return () => clearInterval(interval);
  }, [enabled, isCameraActive, isModelsLoaded, onViolation, settings]);

  return {
    videoRef,
    isCameraActive,
    isFaceDetected,
    isModelsLoaded,
    startCamera,
    stopCamera
  };
}

