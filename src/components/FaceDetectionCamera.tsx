
import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Camera, CameraOff } from 'lucide-react';

type DetectedFace = {
  detection: faceapi.FaceDetection;
  expressions?: faceapi.FaceExpressions;
  age?: number;
  gender?: string;
};

const FaceDetectionCamera = () => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Load face detection models
  useEffect(() => {
    const loadModels = async () => {
      setIsModelLoading(true);
      try {
        // Load models from public folder
        const MODEL_URL = '/models';
        
        // Display loading toast
        toast({
          title: "Loading face detection models",
          description: "This may take a moment...",
        });
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
        ]);
        
        toast({
          title: "Models loaded successfully",
          description: "You can now start the camera",
        });
      } catch (error) {
        console.error('Error loading models:', error);
        toast({
          variant: "destructive",
          title: "Error loading models",
          description: "Please check your connection and try again",
        });
      } finally {
        setIsModelLoading(false);
      }
    };

    loadModels();
    
    // Cleanup function
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [toast]);

  const startCamera = async () => {
    try {
      if (videoRef.current) {
        const currentStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" }
        });
        
        videoRef.current.srcObject = currentStream;
        setStream(currentStream);
        setIsCameraActive(true);
        
        toast({
          title: "Camera activated",
          description: "Face detection is now running",
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

  // Handle face detection when video is playing
  const handleVideoPlay = () => {
    if (!canvasRef.current || !videoRef.current) return;
    
    const displaySize = {
      width: videoRef.current.videoWidth,
      height: videoRef.current.videoHeight
    };
    
    faceapi.matchDimensions(canvasRef.current, displaySize);
    
    const detectFaces = async () => {
      if (!videoRef.current || !canvasRef.current || !isCameraActive) return;
      
      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions()
        .withAgeAndGender();
      
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
            gender: detection.gender
          }))
        );
      }
      
      // Continue detection if camera is active
      if (isCameraActive) {
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
            >
              <Camera className="mr-2 h-4 w-4" />
              Start Camera
            </Button>
          </div>
        )}
      </div>
      
      {isCameraActive && (
        <>
          <Button 
            onClick={stopCamera} 
            variant="destructive" 
            className="mb-6"
          >
            <CameraOff className="mr-2 h-4 w-4" />
            Stop Camera
          </Button>
          
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
    </div>
  );
};

export default FaceDetectionCamera;
