
import { supabase } from '@/integrations/supabase/client';
import { DetectedFace } from './FaceDetectionService';

export interface Person {
  id: string;
  name: string;
  notes?: string;
  notifyOnRecognition?: boolean;
  createdAt: Date;
  updatedAt: Date;
  faces?: DetectedFace[];
  userId?: string;
}

export class PersonService {
  private static RECOGNITION_THRESHOLD = 0.55; // Threshold for face matching (0.5-0.6 is typical)
  
  static async getAllPersons(): Promise<Person[]> {
    try {
      const { data: persons, error } = await supabase
        .from('persons')
        .select('*');
        
      if (error) {
        console.error('Error fetching persons:', error);
        return [];
      }
      
      // Convert database dates to JavaScript dates
      return persons.map(person => ({
        id: person.id,
        name: person.name,
        notes: person.notes,
        notifyOnRecognition: person.notify_on_recognition,
        createdAt: new Date(person.created_at),
        updatedAt: new Date(person.updated_at),
        userId: person.user_id
      }));
    } catch (error) {
      console.error('Error processing persons:', error);
      return [];
    }
  }
  
  static async getPersonWithFaces(personId: string): Promise<Person | null> {
    try {
      // Get the person data
      const { data: person, error: personError } = await supabase
        .from('persons')
        .select('*')
        .eq('id', personId)
        .single();
        
      if (personError || !person) {
        console.error('Error fetching person:', personError);
        return null;
      }
      
      // Get faces for this person
      const { data: faces, error: facesError } = await supabase
        .from('stored_faces')
        .select('*')
        .eq('person_id', personId);
        
      if (facesError) {
        console.error('Error fetching faces for person:', facesError);
        return {
          id: person.id,
          name: person.name,
          notes: person.notes,
          notifyOnRecognition: person.notify_on_recognition,
          createdAt: new Date(person.created_at),
          updatedAt: new Date(person.updated_at),
          userId: person.user_id,
          faces: []
        };
      }
      
      // Convert faces data
      const processedFaces = faces.map(face => ({
        id: face.id,
        name: face.name,
        descriptor: new Float32Array(face.descriptor),
        image: face.image,
        age: face.age,
        gender: face.gender,
        timestamp: new Date(face.created_at || face.last_seen),
        notifyOnRecognition: face.notify_on_recognition,
        notes: face.notes,
        detection: null,
        personId: face.person_id
      }));
      
      return {
        id: person.id,
        name: person.name,
        notes: person.notes,
        notifyOnRecognition: person.notify_on_recognition,
        createdAt: new Date(person.created_at),
        updatedAt: new Date(person.updated_at),
        userId: person.user_id,
        faces: processedFaces
      };
    } catch (error) {
      console.error('Error processing person with faces:', error);
      return null;
    }
  }
  
  static async updatePerson(person: Person): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('persons')
        .update({
          name: person.name,
          notes: person.notes,
          notify_on_recognition: person.notifyOnRecognition,
          updated_at: new Date().toISOString()
        })
        .eq('id', person.id);
        
      return !error;
    } catch (error) {
      console.error('Error updating person:', error);
      return false;
    }
  }
  
  static async deletePerson(personId: string): Promise<boolean> {
    try {
      // The faces will be automatically deleted due to the CASCADE constraint
      const { error } = await supabase
        .from('persons')
        .delete()
        .eq('id', personId);
        
      return !error;
    } catch (error) {
      console.error('Error deleting person:', error);
      return false;
    }
  }
  
  static async addFaceToPerson(personId: string, face: DetectedFace): Promise<string | undefined> {
    try {
      if (!face.descriptor || !face.image) {
        console.error('Cannot store face without descriptor and image');
        return undefined;
      }
      
      // Convert descriptor to array before storing
      const descriptorArray = Array.from(face.descriptor);
      
      const { data, error } = await supabase
        .from('stored_faces')
        .insert({
          name: face.name || 'Unknown',
          descriptor: descriptorArray,
          image: face.image,
          age: face.age,
          gender: face.gender,
          notify_on_recognition: face.notifyOnRecognition || false,
          notes: face.notes || '',
          person_id: personId,
          user_id: null // This will be set by RLS if needed
        })
        .select('id')
        .single();
        
      if (error) {
        console.error('Error adding face to person:', error);
        return undefined;
      }
      
      return data.id;
    } catch (error) {
      console.error('Error adding face to person:', error);
      return undefined;
    }
  }
  
  static async createPersonWithFace(face: DetectedFace): Promise<string | undefined> {
    try {
      // First create the person
      const { data: personData, error: personError } = await supabase
        .from('persons')
        .insert({
          name: face.name || 'Unknown Person',
          notes: face.notes,
          notify_on_recognition: face.notifyOnRecognition || false,
          user_id: null // This will be set by RLS if needed
        })
        .select('id')
        .single();
        
      if (personError || !personData) {
        console.error('Error creating new person:', personError);
        return undefined;
      }
      
      // Then add the face to this person
      const faceId = await this.addFaceToPerson(personData.id, face);
      
      if (!faceId) {
        // If face creation fails, delete the person to avoid orphaned persons
        await this.deletePerson(personData.id);
        return undefined;
      }
      
      return personData.id;
    } catch (error) {
      console.error('Error creating person with face:', error);
      return undefined;
    }
  }
  
  static async findBestMatchingPerson(descriptor: Float32Array): Promise<{person: Person | null, distance: number}> {
    try {
      // Get all persons with their faces
      const persons = await this.getAllPersons();
      if (persons.length === 0) {
        return { person: null, distance: Infinity };
      }
      
      let bestMatchPerson: Person | null = null;
      let minDistance = Infinity;
      
      // For each person, get their faces and compare descriptors
      for (const person of persons) {
        const personWithFaces = await this.getPersonWithFaces(person.id);
        if (!personWithFaces || !personWithFaces.faces || personWithFaces.faces.length === 0) {
          continue;
        }
        
        // Compare with each face of this person
        for (const face of personWithFaces.faces) {
          if (!face.descriptor) continue;
          
          const distance = this.calculateFaceDistance(descriptor, face.descriptor);
          
          if (distance < minDistance) {
            minDistance = distance;
            bestMatchPerson = personWithFaces;
          }
        }
      }
      
      return {
        person: bestMatchPerson,
        distance: minDistance
      };
    } catch (error) {
      console.error('Error finding best matching person:', error);
      return { person: null, distance: Infinity };
    }
  }
  
  // Euclidean distance between two face descriptors
  static calculateFaceDistance(descriptor1: Float32Array, descriptor2: Float32Array): number {
    if (!descriptor1 || !descriptor2 || descriptor1.length !== descriptor2.length) {
      return Infinity;
    }
    
    let sum = 0;
    for (let i = 0; i < descriptor1.length; i++) {
      const diff = descriptor1[i] - descriptor2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
  
  // Determine if a face should be clustered with an existing person
  static shouldClusterWithPerson(distance: number): boolean {
    return distance < this.RECOGNITION_THRESHOLD;
  }
}
