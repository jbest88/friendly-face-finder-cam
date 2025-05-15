
import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import ModelLoader from './face-detection/ModelLoader';
import CameraControls from './face-detection/CameraControls';
import FaceDetectionDisplay from './face-detection/FaceDetectionDisplay';
import SavedFacesDialog from './face-detection/SavedFacesDialog';
import RecognitionStatus from './face-detection/RecognitionStatus';
import { FaceDetectionService, DetectedFace } from '../services/FaceDetectionService';
import { CameraManager } from '../services/CameraManager';
import { Button } from './ui/button';
import { Save } from 'lucide-react';

const FaceDetectionCamera = () => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [savedFaces, setSavedFaces] = useState<DetectedFace[]>([]);
  const [databaseFaces, setDatabaseFaces] = useState<DetectedFace[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [showSavedFaces, setShowSavedFaces] = useState(false);
  const [processingFaces, setProcessingFaces] = useState(false);

  // Load saved faces from localStorage and database on component mount
  useEffect(() => {
    setSavedFaces(FaceDetectionService.loadSavedFaces());
    loadDatabaseFaces();
    
    // Cleanup function
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const loadDatabaseFaces = async () => {
    try {
      const faces = await FaceDetectionService.getFacesFromDatabase();
      setDatabaseFaces(faces);
    } catch (error) {
      console.error('Error loading faces from database:', error);
    }
  };

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

  // Capture current face and save it to database
  const captureFace = async () => {
    if (detectedFaces.length === 0) {
      toast({
        title: "No faces detected",
        description: "Position your face in the camera view",
      });
      return;
    }
    
    try {
      setProcessingFaces(true);
      
      // Capture the current frame from video
      if (!videoRef.current) return;
      
      const capturedFaces = FaceDetectionService.captureFaceImage(videoRef.current, detectedFaces);
      
      // Save to database
      for (const face of capturedFaces) {
        await FaceDetectionService.storeFaceInDatabase(face);
      }
      
      // Update local state
      setSavedFaces(prev => [...prev, ...capturedFaces]);
      FaceDetectionService.saveFaces([...savedFaces, ...capturedFaces]);
      
      // Refresh database faces
      await loadDatabaseFaces();
      
      toast({
        title: "Face captured",
        description: `Saved ${capturedFaces.length} face(s) to database`,
      });
    } catch (error) {
      console.error('Error capturing face:', error);
      toast({
        variant: "destructive",
        title: "Capture failed",
        description: "Could not save the detected face",
      });
    } finally {
      setProcessingFaces(false);
    }
  };

  // Handle face detection when video is playing
  const handleVideoPlay = () => {
    if (!canvasRef.current || !videoRef.current || !modelsLoaded) return;
    
    const detectFaces = async () => {
      if (!videoRef.current || !canvasRef.current || !isCameraActive || !modelsLoaded) return;
      
      const currentDetectedFaces = await FaceDetectionService.detectFaces(
        videoRef.current, 
        canvasRef.current
      );
      
      // If we have database faces, check for matches
      if (databaseFaces.length > 0) {
        const recognizedFaces = currentDetectedFaces.map(face => {
          const match = FaceDetectionService.compareFaces(face, databaseFaces);
          if (match) {
            // If this face has notify_on_recognition set, show notification
            if (match.notifyOnRecognition) {
              toast({
                title: `Recognized: ${match.name}`,
                description: match.notes || "This person is in your database",
              });
            }
            return match;
          }
          return face;
        });
        
        setDetectedFaces(recognizedFaces);
      } else {
        setDetectedFaces(currentDetectedFaces);
      }
      
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
            savedCount={databaseFaces.length}
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
            savedCount={databaseFaces.length}
          />

          {detectedFaces.length > 0 && (
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {detectedFaces.map((face) => (
                <div key={face.id} className="space-y-2">
                  <RecognitionStatus face={face} />
                  {!face.isRecognized && (
                    <Button
                      size="sm"
                      onClick={() => captureFace()}
                      disabled={processingFaces}
                      className="w-full"
                    >
                      <Save className="mr-2 h-4 w-4" /> 
                      {processingFaces ? "Saving..." : "Save to Database"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          
          <FaceDetectionDisplay detectedFaces={detectedFaces} />
        </>
      )}
      
      <SavedFacesDialog
        open={showSavedFaces}
        onOpenChange={setShowSavedFaces}
        savedFaces={savedFaces}
        onUpdateFaces={loadDatabaseFaces}
      />
    </div>
  );
};

export default FaceDetectionCamera;
