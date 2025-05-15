
import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import ModelLoader from './face-detection/ModelLoader';
import CameraControls from './face-detection/CameraControls';
import FaceDetectionDisplay from './face-detection/FaceDetectionDisplay';
import SavedFacesDialog from './face-detection/SavedFacesDialog';
import { FaceDetectionService, DetectedFace } from '../services/FaceDetectionService';
import { CameraManager } from '../services/CameraManager';

const FaceDetectionCamera = () => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [savedFaces, setSavedFaces] = useState<DetectedFace[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [showSavedFaces, setShowSavedFaces] = useState(false);

  // Load saved faces from localStorage on component mount
  useEffect(() => {
    setSavedFaces(FaceDetectionService.loadSavedFaces());
    
    // Cleanup function
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleModelsLoaded = () => {
    setModelsLoaded(true);
  };

  const startCamera = async () => {
    try {
      // Stop any existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      const currentStream = await CameraManager.startCamera(videoRef.current, facingMode);
      
      if (currentStream) {
        setStream(currentStream);
        setIsCameraActive(true);
        
        toast({
          title: "Camera activated",
          description: `Using ${facingMode === 'user' ? 'front' : 'back'} camera`,
        });
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        variant: "destructive",
        title: "Cannot access camera",
        description: "Please grant camera permissions and try again",
      });
    }
  };

  const stopCamera = () => {
    CameraManager.stopCamera(stream, videoRef.current);
    setStream(null);
    setIsCameraActive(false);
    setDetectedFaces([]);
  };

  const switchCamera = async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    
    // Only restart camera if it's currently active
    if (isCameraActive) {
      await stopCamera();
      // Small timeout to ensure camera has fully stopped
      setTimeout(() => startCamera(), 300);
    }
  };

  // Capture current face and save it
  const captureFace = async () => {
    if (detectedFaces.length === 0) {
      toast({
        title: "No faces detected",
        description: "Position your face in the camera view",
      });
      return;
    }
    
    try {
      // Capture the current frame from video
      if (!videoRef.current) return;
      
      const newSavedFaces = FaceDetectionService.captureFaceImage(videoRef.current, detectedFaces);
      
      // Add to saved faces
      const updatedSavedFaces = [...savedFaces, ...newSavedFaces];
      setSavedFaces(updatedSavedFaces);
      
      // Save to localStorage
      FaceDetectionService.saveFaces(updatedSavedFaces);
      
      toast({
        title: "Face captured",
        description: `Saved ${newSavedFaces.length} face(s) successfully`,
      });
    } catch (error) {
      console.error('Error capturing face:', error);
      toast({
        variant: "destructive",
        title: "Capture failed",
        description: "Could not save the detected face",
      });
    }
  };

  // Handle face detection when video is playing
  const handleVideoPlay = () => {
    if (!canvasRef.current || !videoRef.current || !modelsLoaded) return;
    
    const detectFaces = async () => {
      if (!videoRef.current || !canvasRef.current || !isCameraActive || !modelsLoaded) return;
      
      const detectedFaces = await FaceDetectionService.detectFaces(
        videoRef.current, 
        canvasRef.current
      );
      
      setDetectedFaces(detectedFaces);
      
      // Continue detection if camera is active
      if (isCameraActive && modelsLoaded) {
        requestAnimationFrame(detectFaces);
      }
    };
    
    detectFaces();
  };

  return (
    <div className="flex flex-col items-center w-full max-w-3xl mx-auto">
      <div className="relative w-full aspect-[4/3] bg-black rounded-lg overflow-hidden mb-4">
        {!modelsLoaded && <ModelLoader onModelsLoaded={handleModelsLoaded} />}
        
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          playsInline
          onPlay={handleVideoPlay}
        />
        
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />
        
        {!isCameraActive && modelsLoaded && (
          <CameraControls
            isCameraActive={false}
            facingMode={facingMode}
            hasFacesToSave={false}
            onStartCamera={startCamera}
            onStopCamera={() => {}}
            onSwitchCamera={() => {}}
            onCaptureFace={() => {}}
            onViewSaved={() => setShowSavedFaces(true)}
            savedCount={savedFaces.length}
          />
        )}
      </div>
      
      {isCameraActive && (
        <>
          <CameraControls
            isCameraActive={true}
            facingMode={facingMode}
            hasFacesToSave={detectedFaces.length > 0}
            onStartCamera={startCamera}
            onStopCamera={stopCamera}
            onSwitchCamera={switchCamera}
            onCaptureFace={captureFace}
            onViewSaved={() => setShowSavedFaces(true)}
            savedCount={savedFaces.length}
          />
          
          <FaceDetectionDisplay detectedFaces={detectedFaces} />
        </>
      )}
      
      <SavedFacesDialog
        open={showSavedFaces}
        onOpenChange={setShowSavedFaces}
        savedFaces={savedFaces}
      />
    </div>
  );
};

export default FaceDetectionCamera;
