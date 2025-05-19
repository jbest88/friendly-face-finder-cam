import { supabase } from "@/integrations/supabase/client";
import * as faceapi from '@vladmandic/face-api';

export interface DetectedFace {
  id: string;
  image?: string;
  timestamp: Date;
  name?: string;
  notes?: string;
  detection?: faceapi.IDetection;
  descriptor?: Float32Array;
  expressions?: faceapi.IExpressionScores;
  age?: number;
  gender?: faceapi.Gender;
  isRecognized?: boolean;
  personId?: string;
  notifyOnRecognition?: boolean;
}

export class FaceDetectionService {
  private static FACE_API_URL = '/models';
  private static FACE_SIZE = 320;
  private static MIN_CONFIDENCE = 0.8;
  
  /**
   * Load all faceapi models
   */
  static async loadModels(): Promise<void> {
    console.log('Loading face detection models...');
    
    await faceapi.nets.tinyFaceDetector.loadFromUri(FaceDetectionService.FACE_API_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(FaceDetectionService.FACE_API_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(FaceDetectionService.FACE_API_URL);
    await faceapi.nets.faceExpressionNet.loadFromUri(FaceDetectionService.FACE_API_URL);
    await faceapi.nets.ageGenderNet.loadFromUri(FaceDetectionService.FACE_API_URL);
    
    console.log('All face detection models loaded!');
  }
  
  /**
   * Detect faces in the video stream
   */
  static async detectFaces(
    video: HTMLVideoElement, 
    canvas: HTMLCanvasElement
  ): Promise<DetectedFace[]> {
    if (!video) {
      console.warn('No video stream detected');
      return [];
    }
    
    // Set canvas dimensions to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Use the tiny face detector
    const detections = await faceapi.detectAllFaces(
      video, 
      new faceapi.TinyFaceDetectorOptions({ 
        inputSize: FaceDetectionService.FACE_SIZE, 
        scoreThreshold: FaceDetectionService.MIN_CONFIDENCE 
      })
    )
      .withFaceLandmarks()
      .withFaceExpressions()
      .withAgeAndGender()
      .withFaceDescriptors();
    
    if (!detections || detections.length === 0) {
      return [];
    }
    
    // Draw the detections on the canvas
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    faceapi.matchDimensions(canvas, displaySize);
    faceapi.getContext2d(canvas).clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawDetections(canvas, resizedDetections);
    // faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
    // faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
    
    // Convert faceapi detections to our DetectedFace format
    return detections.map(detection => ({
      detection: detection.detection,
      expressions: detection.expressions,
      age: detection.age,
      gender: detection.gender,
      descriptor: detection.descriptor,
      timestamp: new Date(),
      id: FaceDetectionService.generateFaceId(),
    }));
  }
  
  /**
   * Compare detected face against known faces
   */
  static compareFaces(
    detectedFace: DetectedFace, 
    knownFaces: DetectedFace[]
  ): DetectedFace | undefined {
    if (!detectedFace.descriptor || knownFaces.length === 0) {
      return undefined;
    }
    
    const faceMatcher = new faceapi.FaceMatcher(
      knownFaces.map(face => new faceapi.LabeledFaceDescriptors(
        face.id, 
        [face.descriptor!]
      ))
    );
    
    const bestMatch = faceMatcher.findBestMatch(detectedFace.descriptor);
    
    if (bestMatch.label === 'unknown') {
      return undefined;
    }
    
    const matchedFace = knownFaces.find(face => face.id === bestMatch.label);
    
    if (matchedFace) {
      matchedFace.isRecognized = true;
    }
    
    return matchedFace;
  }
  
  /**
   * Capture the current face image from the video stream
   */
  static captureFaceImage(
    video: HTMLVideoElement, 
    detectedFaces: DetectedFace[]
  ): DetectedFace[] {
    if (!video || detectedFaces.length === 0) {
      console.warn('No video stream or faces detected');
      return [];
    }
    
    const capturedFaces: DetectedFace[] = [];
    
    detectedFaces.forEach(face => {
      if (!face.detection) return;
      
      // Extract face region from video frame
      const { x, y, width, height } = face.detection.box;
      
      // Create a canvas to draw the face region
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return;
      
      // Draw the face region on the canvas
      ctx.drawImage(
        video,
        x,
        y,
        width,
        height,
        0,
        0,
        width,
        height
      );
      
      // Convert the canvas to a data URL
      const imageData = canvas.toDataURL('image/jpeg');
      
      // Add the image data to the face object
      face.image = imageData;
      capturedFaces.push(face);
    });
    
    return capturedFaces;
  }
  
  /**
   * Generate a unique ID for each detected face
   */
  private static generateFaceId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  
  /**
   * Save face to local storage
   */
  static saveFaces(faces: DetectedFace[]): void {
    localStorage.setItem('savedFaces', JSON.stringify(faces));
  }
  
  /**
   * Get faces from local storage
   */
  static getFacesFromLocalStorage(): DetectedFace[] {
    const savedFaces = localStorage.getItem('savedFaces');
    return savedFaces ? JSON.parse(savedFaces) : [];
  }
  
  /**
   * Store face in database
   */
  static async storeFaceInDatabase(face: DetectedFace): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('faces')
        .insert({
          image: face.image,
          timestamp: face.timestamp.toISOString(),
          name: face.name,
          notes: face.notes,
          detection: face.detection,
          descriptor: face.descriptor ? Array.from(face.descriptor) : null,
          expressions: face.expressions,
          age: face.age,
          gender: face.gender,
          person_id: face.personId,
          notify_on_recognition: face.notifyOnRecognition
        })
        .select()
        .single();
        
      if (error) {
        console.error('Error saving face to database:', error);
        throw error;
      }
      
      return data.id;
    } catch (error) {
      console.error('Error saving face to database:', error);
      throw error;
    }
  }
  
  /**
   * Get faces from database
   */
  static async getFacesFromDatabase(): Promise<DetectedFace[]> {
    try {
      const { data, error } = await supabase
        .from('faces')
        .select('*')
        .order('timestamp', { ascending: false });
        
      if (error) {
        console.error('Error fetching faces from database:', error);
        return [];
      }
      
      // Convert the data to our DetectedFace format
      return data.map(face => ({
        ...face,
        timestamp: new Date(face.timestamp),
        descriptor: face.descriptor ? new Float32Array(face.descriptor) : undefined,
        notifyOnRecognition: face.notify_on_recognition,
        personId: face.person_id,
      })) as DetectedFace[];
    } catch (error) {
      console.error('Error fetching faces from database:', error);
      return [];
    }
  }
  
  /**
   * Update face in database
   */
  static async updateFaceInDatabase(face: DetectedFace): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('faces')
        .update({
          name: face.name,
          notes: face.notes,
          notify_on_recognition: face.notifyOnRecognition
        })
        .eq('id', face.id);
        
      if (error) {
        console.error('Error updating face in database:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error updating face in database:', error);
      return false;
    }
  }
  
  /**
   * Delete face from database
   */
  static async deleteFaceFromDatabase(faceId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('faces')
        .delete()
        .eq('id', faceId);
        
      if (error) {
        console.error('Error deleting face from database:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting face from database:', error);
      return false;
    }
  }
  
  /**
   * Auto-save unidentified face
   */
  static async autoSaveUnidentifiedFace(face: DetectedFace): Promise<void> {
    try {
      face.name = 'Unidentified Face';
      face.notes = 'Automatically saved';
      
      // Store in database
      const id = await FaceDetectionService.storeFaceInDatabase(face);
      console.log('Auto-saved face with ID:', id);
      
      // Update local storage
      const savedFaces = FaceDetectionService.getFacesFromLocalStorage();
      savedFaces.push(face);
      FaceDetectionService.saveFaces(savedFaces);
    } catch (error) {
      console.error('Error auto-saving face:', error);
    }
  }
  
  /**
   * Create a new person from an existing face
   */
  static async createPersonFromFace(faceId: string): Promise<string> {
    try {
      // First get the face data
      const { data: face, error: faceError } = await supabase
        .from('faces')
        .select('*')
        .eq('id', faceId)
        .single();
      
      if (faceError || !face) {
        console.error('Error loading face for person creation:', faceError);
        throw new Error('Could not find face');
      }
      
      // Create a new person
      const { data: person, error: personError } = await supabase
        .from('persons')
        .insert({
          name: face.name || 'Unknown Person',
          notes: face.notes,
          notify_on_recognition: face.notify_on_recognition,
        })
        .select()
        .single();
      
      if (personError || !person) {
        console.error('Error creating person:', personError);
        throw new Error('Could not create person');
      }
      
      // Update the face with the new person_id
      const { error: updateError } = await supabase
        .from('faces')
        .update({ person_id: person.id })
        .eq('id', faceId);
      
      if (updateError) {
        console.error('Error updating face with person ID:', updateError);
        throw new Error('Could not link face to person');
      }
      
      return person.id;
    } catch (error) {
      console.error('Error in createPersonFromFace:', error);
      throw error;
    }
  }
  
  /**
   * Add a face to an existing person
   */
  static async addFaceToPerson(faceId: string, personId: string): Promise<boolean> {
    try {
      // Get the target person data
      const { data: person, error: personError } = await supabase
        .from('persons')
        .select('*')
        .eq('id', personId)
        .single();
      
      if (personError || !person) {
        console.error('Error loading person:', personError);
        throw new Error('Could not find person');
      }
      
      // Update the face with the person_id
      const { error: updateError } = await supabase
        .from('faces')
        .update({ 
          person_id: personId,
          name: person.name // Keep name in sync with person
        })
        .eq('id', faceId);
      
      if (updateError) {
        console.error('Error adding face to person:', updateError);
        throw new Error('Could not add face to person');
      }
      
      return true;
    } catch (error) {
      console.error('Error in addFaceToPerson:', error);
      return false;
    }
  }

  /**
   * Get recognition history for a face or person
   */
  static async getRecognitionHistory(
    id: string, 
    type: 'face' | 'person' = 'face', 
    limit: number = 20
  ): Promise<any[]> {
    try {
      let query = supabase
        .from('recognition_notifications')
        .select('*')
        .order('recognized_at', { ascending: false })
        .limit(limit);
      
      if (type === 'face') {
        query = query.eq('face_id', id);
      } else {
        // For person type, we need to get all faces belonging to this person
        const { data: faces, error: facesError } = await supabase
          .from('faces')
          .select('id')
          .eq('person_id', id);
        
        if (facesError || !faces) {
          console.error('Error getting faces for person:', facesError);
          return [];
        }
        
        // Extract face IDs
        const faceIds = faces.map(face => face.id);
        
        if (faceIds.length === 0) {
          return [];
        }
        
        // Query for notifications with any of these face IDs
        query = query.in('face_id', faceIds);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error getting recognition history:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error in getRecognitionHistory:', error);
      return [];
    }
  }
}
