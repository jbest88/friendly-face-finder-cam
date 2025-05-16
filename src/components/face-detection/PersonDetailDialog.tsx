
import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Person, PersonService } from '@/services/PersonService';
import { DetectedFace, FaceDetectionService } from '@/services/FaceDetectionService';
import FaceEditor from './FaceEditor';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Trash2, Edit, ImagePlus } from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';
import { generateTemporaryId } from '@/utils/idGenerator';

interface PersonDetailDialogProps {
  personId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdatePerson?: () => void;
}

const PersonDetailDialog: React.FC<PersonDetailDialogProps> = ({ 
  personId, 
  open, 
  onOpenChange,
  onUpdatePerson
}) => {
  const { toast } = useToast();
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingFace, setEditingFace] = useState<DetectedFace | null>(null);
  const [isAddingImage, setIsAddingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Load person data when dialog opens
  useEffect(() => {
    if (open && personId) {
      loadPersonData(personId);
    }
  }, [open, personId]);
  
  const loadPersonData = async (id: string) => {
    setLoading(true);
    try {
      const personData = await PersonService.getPersonWithFaces(id);
      setPerson(personData);
    } catch (error) {
      console.error('Error loading person data:', error);
      toast({
        title: "Error",
        description: "Could not load person details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpdatePerson = async (updatedPerson: Person) => {
    try {
      const success = await PersonService.updatePerson(updatedPerson);
      
      if (success) {
        setPerson(updatedPerson);
        toast({
          title: "Success",
          description: "Person information updated",
        });
        if (onUpdatePerson) onUpdatePerson();
      } else {
        throw new Error("Failed to update person");
      }
    } catch (error) {
      console.error('Error updating person:', error);
      toast({
        title: "Error",
        description: "Failed to update person information",
        variant: "destructive"
      });
    }
  };
  
  const handleSaveFace = async (updatedFace: DetectedFace) => {
    // If this is a person-level edit, update the person
    if (updatedFace.personId && person) {
      const updatedPerson = {
        ...person,
        name: updatedFace.name || person.name,
        notes: updatedFace.notes,
        notifyOnRecognition: updatedFace.notifyOnRecognition
      };
      
      await handleUpdatePerson(updatedPerson);
      setEditingFace(null);
      return;
    }
    
    // Otherwise handle as an individual face update
    // Note: This branch is for future use if we implement individual face editing
  };
  
  const handleDeletePerson = async () => {
    if (!person) return;
    
    if (!window.confirm(`Are you sure you want to delete ${person.name} and all associated faces?`)) {
      return;
    }
    
    try {
      const success = await PersonService.deletePerson(person.id);
      
      if (success) {
        toast({
          title: "Success",
          description: `Deleted ${person.name} and all associated faces`,
        });
        onOpenChange(false);
        if (onUpdatePerson) onUpdatePerson();
      } else {
        throw new Error("Failed to delete person");
      }
    } catch (error) {
      console.error('Error deleting person:', error);
      toast({
        title: "Error", 
        description: "Failed to delete person",
        variant: "destructive"
      });
    }
  };

  const handleAddImageClick = (personId: string) => {
    setIsAddingImage(true);
    // Use timeout to ensure the DOM is updated before clicking
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }, 100);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !person) return;

    setIsProcessing(true);
    toast({
      title: "Processing images",
      description: "Analyzing faces in uploaded images..."
    });

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Create image element from file
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
          image.src = URL.createObjectURL(file);
        });

        // Detect face in the image
        const detection = await faceapi.detectSingleFace(
          img, 
          new faceapi.TinyFaceDetectorOptions({ inputSize: 320 })
        )
          .withFaceLandmarks()
          .withFaceExpressions()
          .withAgeAndGender()
          .withFaceDescriptor();

        if (!detection) {
          toast({
            title: "No face detected",
            description: `No faces found in "${file.name}"`,
            variant: "destructive"
          });
          continue;
        }

        // Convert to base64 for storage
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d')?.drawImage(img, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);

        // Create face object
        const face: DetectedFace = {
          detection: detection.detection,
          expressions: detection.expressions,
          age: detection.age,
          gender: detection.gender,
          descriptor: detection.descriptor,
          timestamp: new Date(),
          id: generateTemporaryId(),
          image: imageData,
          name: person.name,
          personId: person.id,
          notifyOnRecognition: person.notifyOnRecognition,
          notes: person.notes
        };

        // Store the face
        await FaceDetectionService.storeFaceInDatabase(face);
      }

      // Reload person data to show new images
      await loadPersonData(person.id);
      
      toast({
        title: "Images added",
        description: `Successfully added new images to ${person.name}`
      });
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: "Error",
        description: `Failed to process images: ${(error as Error).message}`,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setIsAddingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg bg-gray-900 text-white">
          <DialogHeader>
            <DialogTitle>Loading Person Details...</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  if (!person) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg bg-gray-900 text-white">
          <DialogHeader>
            <DialogTitle>Person Not Found</DialogTitle>
          </DialogHeader>
          <p>The requested person could not be found.</p>
        </DialogContent>
      </Dialog>
    );
  }
  
  // Create a face object for the person to use with our existing FaceEditor
  const personAsFace: DetectedFace = {
    id: person.id,
    name: person.name,
    notes: person.notes,
    notifyOnRecognition: person.notifyOnRecognition,
    timestamp: person.updatedAt,
    detection: null,
    personId: person.id,
    image: person.faces && person.faces.length > 0 ? person.faces[0].image : undefined
  };
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {person.name}
              <Button 
                variant="destructive" 
                size="sm" 
                className="ml-2"
                onClick={handleDeletePerson}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Person
              </Button>
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {person.faces ? `${person.faces.length} stored face images` : 'No face images stored'}
              <div className="flex space-x-2 mt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setEditingFace(personAsFace)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit Person Details
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleAddImageClick(person.id)}
                  disabled={isProcessing}
                >
                  <ImagePlus className="h-4 w-4 mr-1" />
                  {isProcessing ? "Processing..." : "Add Images"}
                </Button>
                
                {/* Hidden file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
              </div>
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            <h3 className="text-lg font-medium mb-2">Person Details</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Name</TableCell>
                  <TableCell>{person.name}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Notes</TableCell>
                  <TableCell>{person.notes || 'None'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Notify on Recognition</TableCell>
                  <TableCell>{person.notifyOnRecognition ? 'Yes' : 'No'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Created</TableCell>
                  <TableCell>{person.createdAt.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Last Updated</TableCell>
                  <TableCell>{person.updatedAt.toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          
          {person.faces && person.faces.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Face Images</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                {person.faces.map((face, index) => (
                  <Card key={face.id} className="overflow-hidden bg-black border-gray-800">
                    <div className="h-48 overflow-hidden bg-gray-800">
                      {face.image && (
                        <img 
                          src={face.image} 
                          alt={`Face ${index + 1}`} 
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <CardContent className="p-4">
                      <p className="text-sm text-gray-500 mb-2">
                        ID: {face.id.substring(0, 8)}...
                      </p>
                      <p className="text-sm mb-1 text-gray-300">
                        <span className="font-medium">Captured:</span> {face.timestamp.toLocaleString()}
                      </p>
                      {face.age && (
                        <p className="text-sm mb-1 text-gray-300">
                          <span className="font-medium">Age:</span> ~{Math.round(face.age)} years
                        </p>
                      )}
                      {face.gender && (
                        <p className="text-sm mb-1 text-gray-300">
                          <span className="font-medium">Gender:</span> {face.gender}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {editingFace && (
        <Dialog open={!!editingFace} onOpenChange={(open) => !open && setEditingFace(null)}>
          <DialogContent className="sm:max-w-lg bg-gray-900 text-white">
            <DialogHeader>
              <DialogTitle>Edit Person</DialogTitle>
            </DialogHeader>
            <FaceEditor 
              face={editingFace} 
              onSave={handleSaveFace} 
              onDelete={handleDeletePerson} 
              onAddImage={handleAddImageClick}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default PersonDetailDialog;
