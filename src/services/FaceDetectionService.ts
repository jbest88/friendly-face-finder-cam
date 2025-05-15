import * as faceapi from 'face-api.js';
import { generateTemporaryId } from '@/utils/idGenerator';
import { supabase } from '@/integrations/supabase/client';
import { NotificationsService } from './NotificationsService';

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
  isRecognized?: boolean;
  matchedFaceId?: string;
  similarity?: number;
  notes?: string;
}

export class FaceDetectionService {
  // Face recognition threshold - lower values are more strict
  private static RECOGNITION_THRESHOLD = 0.5;
  
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
  
  static async storeFaceInDatabase(face: DetectedFace): Promise<string | undefined> {
    try {
      if (!face.descriptor || !face.image) {
        console.error('Cannot store face without descriptor and image');
        return undefined;
      }

      // Convert descriptor to array before storing to ensure it's properly saved
      const descriptorArray = Array.from(face.descriptor);
      console.log('Storing face descriptor with length:', descriptorArray.length);

      const { data, error } = await supabase.from('stored_faces').insert({
        name: face.name || 'Unknown',
        descriptor: descriptorArray,
        image: face.image,
        age: face.age,
        gender: face.gender,
        notify_on_recognition: face.notifyOnRecognition || false,
        notes: face.notes || ''
      }).select('id').single();

      if (error) {
        console.error('Error storing face in database:', error);
        return undefined;
      }

      console.log('Face stored successfully with ID:', data.id);
      return data.id;
    } catch (error) {
      console.error('Error storing face in database:', error);
      return undefined;
    }
  }

  static async getFacesFromDatabase(): Promise<DetectedFace[]> {
    try {
      const { data, error } = await supabase.from('stored_faces').select('*');

      if (error) {
        console.error('Error fetching faces from database:', error);
        return [];
      }

      console.log('Fetched faces from database:', data.length);
      
      // Convert from database format to DetectedFace format
      return data.map(record => {
        // Ensure we have a descriptor and it's converted to Float32Array
        if (!record.descriptor || !Array.isArray(record.descriptor)) {
          console.error('Invalid descriptor for face:', record.id);
          return null;
        }
        
        return {
          id: record.id,
          name: record.name,
          descriptor: new Float32Array(record.descriptor),
          image: record.image,
          age: record.age,
          gender: record.gender,
          notifyOnRecognition: record.notify_on_recognition,
          notes: record.notes,
          timestamp: new Date(record.created_at),
          detection: null // Adding the required detection property
        };
      }).filter(face => face !== null) as DetectedFace[]; // Filter out invalid faces
    } catch (error) {
      console.error('Error processing faces from database:', error);
      return [];
    }
  }

  static async updateFaceInDatabase(face: DetectedFace): Promise<boolean> {
    try {
      if (!face.id) return false;

      const { error } = await supabase.from('stored_faces').update({
        name: face.name,
        notify_on_recognition: face.notifyOnRecognition,
        notes: face.notes,
        last_seen: new Date().toISOString()
      }).eq('id', face.id);

      return !error;
    } catch (error) {
      console.error('Error updating face in database:', error);
      return false;
    }
  }

  static async deleteFaceFromDatabase(faceId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('stored_faces').delete().eq('id', faceId);
      return !error;
    } catch (error) {
      console.error('Error deleting face from database:', error);
      return false;
    }
  }

  static compareFaces(detectedFace: DetectedFace, storedFaces: DetectedFace[]): DetectedFace | undefined {
    try {
      if (!detectedFace.descriptor || storedFaces.length === 0) {
        console.log('No descriptor or stored faces to compare');
        return undefined;
      }

      console.log(`Comparing with ${storedFaces.length} stored faces`);
      let bestMatch: { face: DetectedFace, distance: number } | undefined;

      for (const storedFace of storedFaces) {
        if (!storedFace.descriptor) {
          console.log('Skipping face without descriptor');
          continue;
        }

        // Calculate Euclidean distance between face descriptors
        const distance = this.calculateFaceDistance(
          detectedFace.descriptor, 
          storedFace.descriptor
        );

        console.log(`Comparing with ${storedFace.name || 'Unknown'}, distance: ${distance}`);

        // Lower distance = better match
        if (distance < this.RECOGNITION_THRESHOLD && (!bestMatch || distance < bestMatch.distance)) {
          bestMatch = {
            face: storedFace,
            distance
          };
        }
      }

      if (bestMatch) {
        console.log(`Match found: ${bestMatch.face.name}, similarity: ${(1 - bestMatch.distance) * 100}%`);
        
        // Create a matched face with recognition info
        const recognizedFace = {
          ...detectedFace,
          isRecognized: true,
          matchedFaceId: bestMatch.face.id,
          name: bestMatch.face.name,
          notes: bestMatch.face.notes,
          notifyOnRecognition: bestMatch.face.notifyOnRecognition,
          similarity: 1 - bestMatch.distance // Convert distance to similarity (0-1)
        };
        
        // Send notification if the notifyOnRecognition flag is true
        // or if it's undefined (default to notification for backward compatibility)
        if (bestMatch.face.notifyOnRecognition !== false) {
          this.sendRecognitionNotification(recognizedFace);
        }
        
        return recognizedFace;
      }

      console.log('No match found among stored faces');
      return undefined;
    } catch (error) {
      console.error('Error comparing faces:', error);
      return undefined;
    }
  }

  private static calculateFaceDistance(descriptor1: Float32Array, descriptor2: Float32Array): number {
    if (!descriptor1 || !descriptor2 || descriptor1.length !== descriptor2.length) {
      console.error('Invalid descriptors for comparison');
      return Infinity;
    }

    let sum = 0;
    for (let i = 0; i < descriptor1.length; i++) {
      const diff = descriptor1[i] - descriptor2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
  
  private static async sendRecognitionNotification(face: DetectedFace): Promise<void> {
    if (!face.name) return;
    
    try {
      // Capture a new image if one doesn't exist
      if (!face.image) {
        console.log('No image available for notification, skipping');
        return;
      }
      
      console.log(`Sending notification for recognized face: ${face.name}`);
      await NotificationsService.sendRecognitionNotification(
        face.name,
        face.matchedFaceId,
        face.image,
        face.notes
      );
    } catch (error) {
      console.error('Error sending recognition notification:', error);
    }
  }

  // Legacy methods for localStorage
  static loadSavedFaces(): DetectedFace[] {
    try {
      const saved = localStorage.getItem('savedFaces');
      if (saved) {
        const faces = JSON.parse(saved);
        // Convert string dates back to Date objects and add required detection property
        return faces.map((face: any) => ({
          ...face,
          detection: null, // Adding the required detection property
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
