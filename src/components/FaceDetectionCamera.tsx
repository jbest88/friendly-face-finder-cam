
import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Camera, CameraOff, SwitchCamera, ArrowUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { generateTemporaryId } from '@/utils/idGenerator';

type DetectedFace = {
  detection: faceapi.FaceDetection;
  expressions?: faceapi.FaceExpressions;
  age?: number;
  gender?: string;
  descriptor?: Float32Array;
  timestamp: Date;
  id: string;
  image?: string;
  name?: string;
  notifyOnRecognition?: boolean;
};

interface VideoConstraints {
  facingMode: 'user' | 'environment';
}

// We'll refactor this component later to make it smaller
const FaceDetectionCamera = () => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [savedFaces, setSavedFaces] = useState<DetectedFace[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelLoadAttempts, setModelLoadAttempts] = useState(0);
  const [showSavedFaces, setShowSavedFaces] = useState(false);

  // Load face detection models
  useEffect(() => {
    const loadModels = async () => {
      setIsModelLoading(true);
      try {
        // Try different model sources based on load attempts
        let MODEL_URL = '';
        
        // Try different CDNs based on previous attempts
        if (modelLoadAttempts === 0) {
          MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        } else if (modelLoadAttempts === 1) {
          MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights/';
        } else {
          MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
        }
        
        toast({
          title: "Loading face detection models",
          description: `Attempt ${modelLoadAttempts + 1}: Using ${MODEL_URL}`,
        });
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL), // Important for face descriptors
        ]);
        
        setModelsLoaded(true);
        
        toast({
          title: "Models loaded successfully",
          description: "You can now start the camera",
        });
      } catch (error) {
        console.error('Error loading models:', error);
        
        if (modelLoadAttempts < 2) {
          // Try another CDN
          setModelLoadAttempts(modelLoadAttempts + 1);
          toast({
            title: "Trying another model source",
            description: "Previous model source failed, attempting alternative...",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Error loading models",
            description: "Failed to load face detection models after multiple attempts. Please check your connection.",
          });
        }
      } finally {
        setIsModelLoading(false);
      }
    };

    loadModels();
    
    // Load saved faces from localStorage
    const loadSavedFaces = () => {
      try {
        const saved = localStorage.getItem('savedFaces');
        if (saved) {
          setSavedFaces(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Error loading saved faces:', error);
      }
    };
    
    loadSavedFaces();
    
    // Cleanup function
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [toast, modelLoadAttempts]);

  const startCamera = async () => {
    try {
      if (videoRef.current) {
        // Stop any existing stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        
        const constraints: MediaStreamConstraints = {
          video: { facingMode }
        };
        
        const currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        videoRef.current.srcObject = currentStream;
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
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraActive(false);
      setDetectedFaces([]);
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
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
      if (!videoRef.current || !canvasRef.current) return;
      
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return;
      
      // Draw the video frame to the canvas
      ctx.drawImage(videoRef.current, 0, 0);
      
      // Get the image data as base64
      const imageData = canvas.toDataURL('image/jpeg');
      
      // Create new saved face objects with IDs
      const newSavedFaces = detectedFaces.map(face => {
        // Check if we already have this face saved (using facial recognition)
        // For now, just generate a new ID for each face
        return {
          ...face,
          id: generateTemporaryId(),
          image: imageData,
          timestamp: new Date()
        };
      });
      
      // Add to saved faces
      const updatedSavedFaces = [...savedFaces, ...newSavedFaces];
      setSavedFaces(updatedSavedFaces);
      
      // Save to localStorage (temporary solution until we have a backend)
      localStorage.setItem('savedFaces', JSON.stringify(updatedSavedFaces));
      
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
    
    const displaySize = {
      width: videoRef.current.videoWidth,
      height: videoRef.current.videoHeight
    };
    
    faceapi.matchDimensions(canvasRef.current, displaySize);
    
    const detectFaces = async () => {
      if (!videoRef.current || !canvasRef.current || !isCameraActive || !modelsLoaded) return;
      
      try {
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
          .withFaceLandmarks()
          .withFaceExpressions()
          .withAgeAndGender()
          .withFaceDescriptors(); // Add face descriptors for recognition
        
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        // Clear the canvas and draw new results
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          // Draw face detection results on canvas
          faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
          faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections);
          
          // Update state with detected faces
          setDetectedFaces(
            resizedDetections.map(detection => ({
              detection: detection.detection,
              expressions: detection.expressions,
              age: detection.age,
              gender: detection.gender,
              descriptor: detection.descriptor,
              timestamp: new Date(),
              id: generateTemporaryId()
            }))
          );
        }
      } catch (error) {
        console.error('Face detection error:', error);
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
        {isModelLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75 z-10">
            <Loader2 className="h-10 w-10 text-green-500 animate-spin" />
            <p className="text-white ml-2">Loading face detection models...</p>
          </div>
        )}
        
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
        
        {!isCameraActive && !isModelLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75">
            <Button 
              onClick={startCamera} 
              className="bg-green-500 hover:bg-green-600"
              disabled={!modelsLoaded}
            >
              <Camera className="mr-2 h-4 w-4" />
              Start Camera
            </Button>
          </div>
        )}
      </div>
      
      {isCameraActive && (
        <>
          <div className="flex space-x-4 mb-6">
            <Button 
              onClick={stopCamera} 
              variant="destructive" 
            >
              <CameraOff className="mr-2 h-4 w-4" />
              Stop Camera
            </Button>
            
            <Button
              onClick={switchCamera}
              variant="outline"
              className="border-green-500 text-green-500 hover:bg-green-500/10"
            >
              <SwitchCamera className="mr-2 h-4 w-4" />
              Switch Camera ({facingMode === 'user' ? 'Front' : 'Back'})
            </Button>
            
            <Button 
              onClick={captureFace}
              className="bg-green-500 hover:bg-green-600"
              disabled={detectedFaces.length === 0}
            >
              <ArrowUp className="mr-2 h-4 w-4" />
              Save Face
            </Button>
            
            <Button 
              onClick={() => setShowSavedFaces(true)}
              variant="outline"
              className="border-green-500 text-green-500 hover:bg-green-500/10"
            >
              View Saved ({savedFaces.length})
            </Button>
          </div>
          
          <div className="w-full">
            <h2 className="text-xl font-bold mb-4 text-center">
              {detectedFaces.length === 0 
                ? "No faces detected" 
                : `Detected ${detectedFaces.length} ${detectedFaces.length === 1 ? 'face' : 'faces'}`}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {detectedFaces.map((face, index) => (
                <Card key={index} className="overflow-hidden border border-green-500/30 animate-pulse-glow">
                  <CardContent className="p-4">
                    <h3 className="font-medium text-lg mb-2">Face {index + 1}</h3>
                    
                    {face.age && (
                      <p className="text-sm mb-1">
                        <span className="font-medium">Age:</span> {Math.round(face.age)} years
                      </p>
                    )}
                    
                    {face.gender && (
                      <p className="text-sm mb-1">
                        <span className="font-medium">Gender:</span> {face.gender}
                      </p>
                    )}
                    
                    {face.expressions && (
                      <div className="mt-2">
                        <p className="text-sm font-medium mb-1">Expression:</p>
                        <div className="space-y-1">
                          {Object.entries(face.expressions)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 3)
                            .map(([expression, probability]) => (
                              <div key={expression} className="flex items-center">
                                <div className="w-24 text-xs">{expression}</div>
                                <div className="flex-1 bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-green-500 h-full rounded-full" 
                                    style={{ width: `${probability * 100}%` }}
                                  />
                                </div>
                                <div className="w-12 text-right text-xs">
                                  {Math.round(probability * 100)}%
                                </div>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
      
      {/* Dialog to view saved faces */}
      <Dialog open={showSavedFaces} onOpenChange={setShowSavedFaces}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Saved Faces</DialogTitle>
            <DialogDescription>
              {savedFaces.length} faces have been saved. In a full system, these would sync to a backend.
            </DialogDescription>
          </DialogHeader>
          
          {savedFaces.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No faces have been saved yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {savedFaces.map((face, index) => (
                <Card key={face.id} className="overflow-hidden">
                  <div className="h-48 overflow-hidden bg-gray-100">
                    {face.image && (
                      <img 
                        src={face.image} 
                        alt={`Face ${index + 1}`} 
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-medium text-lg mb-2">
                      {face.name || `Unlabeled Face ${index + 1}`}
                    </h3>
                    <p className="text-sm text-gray-500 mb-2">
                      ID: {face.id.substring(0, 8)}...
                    </p>
                    <p className="text-sm mb-1">
                      <span className="font-medium">Captured:</span> {face.timestamp.toString().substring(0, 24)}
                    </p>
                    {face.age && (
                      <p className="text-sm mb-1">
                        <span className="font-medium">Age:</span> ~{Math.round(face.age)} years
                      </p>
                    )}
                    {face.gender && (
                      <p className="text-sm mb-1">
                        <span className="font-medium">Gender:</span> {face.gender}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FaceDetectionCamera;
