
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, Image, User } from 'lucide-react';
import { DetectedFace, FaceDetectionService } from '@/services/FaceDetectionService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FaceEditor from '@/components/face-detection/FaceEditor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import * as faceapi from 'face-api.js';
import { generateTemporaryId } from '@/utils/idGenerator';

const SavedFaces: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [databaseFaces, setDatabaseFaces] = useState<DetectedFace[]>([]);
  const [localFaces, setLocalFaces] = useState<DetectedFace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('database');
  const [editingFace, setEditingFace] = useState<DetectedFace | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);
  
  // Load faces when component mounts
  useEffect(() => {
    if (user) {
      loadFaces();
    }
  }, [user]);
  
  const loadFaces = async () => {
    setIsLoading(true);
    try {
      // Load faces from database
      const dbFaces = await FaceDetectionService.getFacesFromDatabase();
      setDatabaseFaces(dbFaces);
      
      // Load faces from local storage
      const localStorageFaces = FaceDetectionService.getFacesFromLocalStorage();
      setLocalFaces(localStorageFaces);
    } catch (error) {
      console.error('Error loading faces:', error);
      toast({
        title: "Error",
        description: "Could not load saved faces",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSaveFace = async (updatedFace: DetectedFace) => {
    try {
      const success = await FaceDetectionService.updateFaceInDatabase(updatedFace);
      
      if (success) {
        toast({
          title: "Success",
          description: `Updated information for ${updatedFace.name}`,
        });
        
        // Refresh the faces list
        loadFaces();
        setEditingFace(null);
      } else {
        throw new Error("Failed to update face");
      }
    } catch (error) {
      console.error('Error updating face:', error);
      toast({
        title: "Error",
        description: "Could not update face information",
        variant: "destructive"
      });
    }
  };
  
  const handleDeleteFace = async (faceId: string) => {
    try {
      const success = await FaceDetectionService.deleteFaceFromDatabase(faceId);
      
      if (success) {
        toast({
          title: "Success",
          description: "Face deleted successfully",
        });
        
        // Refresh the faces list
        loadFaces();
        setEditingFace(null);
      } else {
        throw new Error("Failed to delete face");
      }
    } catch (error) {
      console.error('Error deleting face:', error);
      toast({
        title: "Error",
        description: "Could not delete face",
        variant: "destructive"
      });
    }
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const image = await loadImage(file);
        
        // Create a temporary canvas
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Cannot get canvas context');
        }
        
        // Draw the image to canvas
        ctx.drawImage(image, 0, 0, image.width, image.height);
        
        // Convert image to base64
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        // Create detector options - FIXED: Direct usage without constructor
        // The TinyFaceDetectorOptions is likely not a class constructor in this context
        // so we'll use it directly as an object        
        // Detect faces in the image - pass the options directly to detectAllFaces
        const detectorOptions = new faceapi.TinyFaceDetectorOptions(320);

const detections = await faceapi
  .detectAllFaces(image, detectorOptions)
  .withFaceLandmarks()
  .withFaceExpressions()
  .withAgeAndGender()
  .withFaceDescriptors();

          
        console.log(`Detected ${detections.length} faces in uploaded image`);
        
        if (detections.length === 0) {
          toast({
            title: "No faces detected",
            description: `No faces could be detected in ${file.name}`,
            variant: "destructive"
          });
          continue;
        }
        
        // For each detected face, create a DetectedFace object
        for (const detection of detections) {
          const face: DetectedFace = {
            detection: detection.detection,
            expressions: detection.expressions,
            age: detection.age,
            gender: detection.gender,
            descriptor: detection.descriptor,
            timestamp: new Date(),
            id: generateTemporaryId(),
            image: imageData,
            name: file.name.split('.')[0] // Use filename as default name
          };
          
          // Store face in database
          await FaceDetectionService.storeFaceInDatabase(face);
        }
        
        toast({
          title: "Success",
          description: `Processed ${detections.length} faces from ${file.name}`,
        });
      }
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      // Refresh faces list
      await loadFaces();
      
    } catch (error) {
      console.error('Error processing uploaded image:', error);
      toast({
        title: "Error",
        description: "Could not process the uploaded image",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  // Helper function to load an image
  const loadImage = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };
  
  // Show loading or login prompt if not authenticated
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <p className="text-xl">Loading...</p>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 mb-6">
          Face Recognition App
        </h1>
        <p className="text-center mb-8 max-w-md">
          Please log in or sign up to use the face recognition features.
        </p>
        <div className="flex gap-4">
          <Button 
            onClick={() => navigate('/login')}
            className="bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600"
          >
            Log In
          </Button>
          <Button 
            onClick={() => navigate('/signup')}
            variant="outline"
            className="text-white border-gray-700 hover:bg-gray-800"
          >
            Sign Up
          </Button>
        </div>
      </div>
    );
  }
  
  const renderFacesList = (faces: DetectedFace[]) => {
    if (isLoading) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading faces...</p>
        </div>
      );
    }
    
    if (faces.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">No faces have been saved yet.</p>
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {faces.map((face, index) => (
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
              <h3 className="font-medium text-lg mb-2 text-white">
                {face.name || `Unlabeled Face ${index + 1}`}
              </h3>
              <p className="text-sm text-gray-500 mb-2">
                ID: {face.id.substring(0, 8)}...
              </p>
              <p className="text-sm mb-1 text-gray-300">
                <span className="font-medium">Captured:</span> {face.timestamp.toString().substring(0, 24)}
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
              <Button 
                variant="outline" 
                className="w-full mt-2 text-white border-gray-700 hover:bg-gray-800"
                onClick={() => setEditingFace(face)}
              >
                Edit Information
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4">
      <div className="max-w-6xl mx-auto pt-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              className="text-white mr-4"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-5 w-5 mr-1" />
              Back
            </Button>
            <h1 className="text-3xl font-bold text-white">Saved Faces</h1>
          </div>
          
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              multiple
              className="hidden"
            />
            <Button 
              onClick={handleUploadClick}
              className="bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600"
              disabled={isUploading}
            >
              {isUploading ? (
                <>Processing...</>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Faces
                </>
              )}
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="database">Database ({databaseFaces.length})</TabsTrigger>
            <TabsTrigger value="local">Local Storage ({localFaces.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="database">
            {renderFacesList(databaseFaces)}
          </TabsContent>
          
          <TabsContent value="local">
            {renderFacesList(localFaces)}
          </TabsContent>
        </Tabs>
      </div>
      
      {editingFace && (
        <Dialog open={!!editingFace} onOpenChange={(open) => !open && setEditingFace(null)}>
          <DialogContent className="sm:max-w-lg bg-gray-900 text-white">
            <DialogHeader>
              <DialogTitle>Edit Face</DialogTitle>
            </DialogHeader>
            <FaceEditor 
              face={editingFace} 
              onSave={handleSaveFace} 
              onDelete={() => handleDeleteFace(editingFace.id)} 
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default SavedFaces;
