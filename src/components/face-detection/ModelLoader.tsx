
import React, { useEffect, useState } from 'react';
// Change the import to use @vladmandic/face-api instead of face-api.js
import * as faceapi from '@vladmandic/face-api';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ModelLoaderProps {
  onModelsLoaded: () => void;
}

const ModelLoader: React.FC<ModelLoaderProps> = ({ onModelsLoaded }) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [modelLoadAttempts, setModelLoadAttempts] = useState(0);

  useEffect(() => {
    const loadModels = async () => {
      setIsLoading(true);
      try {
        // Try different model sources based on previous attempts
        let MODEL_URL = '';
        
        // Try different CDNs based on previous attempts
        if (modelLoadAttempts === 0) {
          MODEL_URL = '/models/'; // First try local models
        } else if (modelLoadAttempts === 1) {
          MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.6/model/';
        } else {
          MODEL_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';
        }
        
        toast({
          title: "Loading face detection models",
          description: `Attempt ${modelLoadAttempts + 1}: Using ${MODEL_URL}`,
        });
        
        // Using direct import for faceapi.nets to avoid TypeScript errors
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        
        toast({
          title: "Models loaded successfully",
          description: "You can now start the camera",
        });
        
        onModelsLoaded();
      } catch (error) {
        console.error('Error loading models:', error);
        
        if (modelLoadAttempts < 2) {
          // Try another CDN
          setModelLoadAttempts(prev => prev + 1);
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
        setIsLoading(false);
      }
    };

    loadModels();
  }, [modelLoadAttempts, onModelsLoaded, toast]);

  if (!isLoading) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/75 z-10">
      <Loader2 className="h-10 w-10 text-green-500 animate-spin" />
      <p className="text-white ml-2">Loading face detection models...</p>
    </div>
  );
};

export default ModelLoader;
