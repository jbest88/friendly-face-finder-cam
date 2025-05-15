
import * as faceapi from 'face-api.js';
import { generateTemporaryId } from '@/utils/idGenerator';

export interface DetectedFace {
  detection: any; // Using 'any' temporarily to resolve TypeScript errors
  expressions?: faceapi.FaceExpressions;
  age?: number;
  gender?: string;
  descriptor?: Float32Array;
  timestamp: Date;
  id: string;
  image?: string;
  name?: string;
  notifyOnRecognition?: boolean;
}

export class FaceDetectionService {
  static async detectFaces(
    videoElement: HTMLVideoElement, 
    canvasElement: HTMLCanvasElement
  ): Promise<DetectedFace[]> {
    if (!videoElement || !canvasElement) return [];
    
    const displaySize = {
      width: videoElement.videoWidth,
      height: videoElement.videoHeight
    };
    
    // @ts-ignore - Ignoring TypeScript error for matchDimensions
    faceapi.matchDimensions(canvasElement, displaySize);
    
    try {
      // @ts-ignore - Ignoring TypeScript errors for detectAllFaces and TinyFaceDetectorOptions
      const detections = await faceapi
        .detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
        .withFaceLandmarks()
        .withFaceExpressions()
        .withAgeAndGender()
        .withFaceDescriptors();
      
      // @ts-ignore - Ignoring TypeScript error for resizeResults
      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      
      // Draw face detection results on canvas
      const ctx = canvasElement.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        // @ts-ignore - Ignoring TypeScript errors for draw methods
        faceapi.draw.drawDetections(canvasElement, resizedDetections);
        // @ts-ignore - Ignoring TypeScript errors for draw methods
        faceapi.draw.drawFaceLandmarks(canvasElement, resizedDetections);
      }
      
      // Convert to our DetectedFace format
      return resizedDetections.map(detection => ({
        detection: detection.detection,
        expressions: detection.expressions,
        age: detection.age,
        gender: detection.gender,
        descriptor: detection.descriptor,
        timestamp: new Date(),
        id: generateTemporaryId()
      }));
    } catch (error) {
      console.error('Face detection error:', error);
      return [];
    }
  }
  
  static captureFaceImage(
    videoElement: HTMLVideoElement, 
    detectedFaces: DetectedFace[]
  ): DetectedFace[] {
    if (detectedFaces.length === 0 || !videoElement) return [];
    
    try {
      // Create a temporary canvas to capture the current frame
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return detectedFaces;
      
      // Draw the video frame to the canvas
      ctx.drawImage(videoElement, 0, 0);
      
      // Get the image data as base64
      const imageData = canvas.toDataURL('image/jpeg');
      
      // Add the image to each detected face
      return detectedFaces.map(face => ({
        ...face,
        id: generateTemporaryId(),
        image: imageData,
        timestamp: new Date()
      }));
    } catch (error) {
      console.error('Error capturing face image:', error);
      return detectedFaces;
    }
  }
  
  static loadSavedFaces(): DetectedFace[] {
    try {
      const saved = localStorage.getItem('savedFaces');
      if (saved) {
        const faces = JSON.parse(saved);
        // Convert string dates back to Date objects
        return faces.map((face: any) => ({
          ...face,
          timestamp: new Date(face.timestamp)
        }));
      }
    } catch (error) {
      console.error('Error loading saved faces:', error);
    }
    return [];
  }
  
  static saveFaces(faces: DetectedFace[]): void {
    try {
      localStorage.setItem('savedFaces', JSON.stringify(faces));
    } catch (error) {
      console.error('Error saving faces:', error);
    }
  }
}
