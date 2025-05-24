import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, User, Users, Bell, Edit, History } from 'lucide-react';
// Change import from face-api.js to @vladmandic/face-api
import * as faceapi from '@vladmandic/face-api';
import { DetectedFace, FaceDetectionService } from '@/services/FaceDetectionService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FaceEditor from '@/components/face-detection/FaceEditor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { generateTemporaryId } from '@/utils/idGenerator';
import ModelLoader from '@/components/face-detection/ModelLoader';
import PersonDetailDialog from '@/components/face-detection/PersonDetailDialog';
import FaceMergeDialog from '@/components/face-detection/FaceMergeDialog';
import FaceHistoryDialog from '@/components/face-detection/FaceHistoryDialog';
import NotificationsTable from '@/components/notifications/NotificationsTable';
import { NotificationsService, FaceRecognitionNotification } from '@/services/NotificationsService';

const SavedFaces: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [persons, setPersons] = useState<DetectedFace[]>([]);
  const [localFaces, setLocalFaces] = useState<DetectedFace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('database');
  const [editingFace, setEditingFace] = useState<DetectedFace | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isPersonDetailOpen, setIsPersonDetailOpen] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedFace, setSelectedFace] = useState<DetectedFace | null>(null);
  const [notifications, setNotifications] = useState<FaceRecognitionNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadFaces = async () => {
    setIsLoading(true);
    try {
      const dbFaces = await FaceDetectionService.getFacesFromDatabase();
      setPersons(dbFaces);
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

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);
  
  const loadNotifications = async () => {
    try {
      const unreadNotifications = await NotificationsService.getUnreadNotifications();
      setNotifications(unreadNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };
  
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const success = await NotificationsService.markAsRead(notificationId);
      if (success) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  
  // Fixed function signatures to match expected types
  const handleMergeFace = (faceId: string) => {
    const face = persons.find(f => f.id === faceId) || localFaces.find(f => f.id === faceId);
    if (face) {
      setSelectedFace(face);
      setShowMergeDialog(true);
    }
  };
  
  const handleViewHistory = (faceId: string) => {
    const face = persons.find(f => f.id === faceId) || localFaces.find(f => f.id === faceId);
    if (face) {
      setSelectedFace(face);
      setShowHistoryDialog(true);
    }
  };

  // Modify the handleSaveFace function to add merge and history options
  const handleSaveFace = async (updatedFace: DetectedFace) => {
    try {
      const success = await FaceDetectionService.updateFaceInDatabase(updatedFace);

      if (success) {
        toast({
          title: "Success",
          description: `Updated information for ${updatedFace.name}`,
        });
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

  const handleViewPersonDetails = (personId: string) => {
    setSelectedPersonId(personId);
    setIsPersonDetailOpen(true);
  };

  // --- Main face upload handler ---
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!modelsLoaded) {
      toast({
        title: "Models still loading",
        description: "Please wait for AI models to finish loading.",
        variant: "destructive"
      });
      return;
    }
    
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Load as image with proper error handling
        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            
            const handleImageLoad = () => {
              image.removeEventListener('load', handleImageLoad);
              image.removeEventListener('error', handleImageError);
              resolve(image);
            };
            
            const handleImageError = () => {
              image.removeEventListener('load', handleImageLoad);
              image.removeEventListener('error', handleImageError);
              reject(new Error(`Failed to load image: ${file.name}`));
            };
            
            image.addEventListener('load', handleImageLoad);
            image.addEventListener('error', handleImageError);
            
            // Set a timeout to reject the promise if it takes too long
            const timeout = setTimeout(() => {
              image.removeEventListener('load', handleImageLoad);
              image.removeEventListener('error', handleImageError);
              reject(new Error(`Timed out loading image: ${file.name}`));
            }, 10000);  // 10 second timeout
            
            image.onload = () => {
              clearTimeout(timeout);
              handleImageLoad();
            };
            
            image.onerror = () => {
              clearTimeout(timeout);
              handleImageError();
            };
            
            image.src = URL.createObjectURL(file);
          });

          // Face detection - explicitly reference faceapi 
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
              description: `No faces detected in "${file.name}"`,
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

          const face: DetectedFace = {
            detection: detection.detection,
            expressions: detection.expressions,
            age: detection.age,
            gender: detection.gender,
            descriptor: detection.descriptor,
            timestamp: new Date(),
            id: generateTemporaryId(),
            image: imageData,
            name: file.name.split('.')[0]
          };

          await FaceDetectionService.storeFaceInDatabase(face);

          toast({
            title: "Face uploaded",
            description: `Face saved from "${file.name}"`,
          });
        } catch (imgError) {
          console.error('Error processing image:', imgError);
          toast({
            title: "Error",
            description: `Failed to process image "${file.name}": ${(imgError as Error).message}`,
            variant: "destructive"
          });
        }
      }

      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadFaces();

    } catch (error) {
      console.error('Error processing uploaded image:', error);
      toast({
        title: "Error",
        description: "Could not process the uploaded image: " + (error as Error).message,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  // --- Render faces helper ---
  const renderPersonsList = (faces: DetectedFace[]) => {
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
            <div className="h-48 overflow-hidden bg-gray-800 cursor-pointer"
                 onClick={() => face.personId ? handleViewPersonDetails(face.personId) : setEditingFace(face)}>
              {face.image ? (
                <img
                  src={face.image}
                  alt={`Face ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                  <User className="h-24 w-24 text-gray-600" />
                </div>
              )}
            </div>
            <CardContent className="p-4">
              <h3 className="font-medium text-lg mb-2 text-white flex items-center">
                {face.personId && <Users className="h-4 w-4 mr-2 text-blue-400" />}
                {face.name || `Unlabeled Face ${index + 1}`}
              </h3>
              <p className="text-sm text-gray-500 mb-2">
                ID: {face.id.substring(0, 8)}...
              </p>
              <p className="text-sm mb-1 text-gray-300">
                <span className="font-medium">Captured:</span> {face.timestamp.toString().substring(0, 24)}
              </p>
              
              <div className="grid grid-cols-2 gap-2 mt-2">
                {face.personId ? (
                  <Button
                    variant="outline"
                    className="text-white border-gray-700 hover:bg-gray-800"
                    onClick={() => handleViewPersonDetails(face.personId!)}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    View Person
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="text-white border-gray-700 hover:bg-gray-800"
                    onClick={() => setEditingFace(face)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  className="text-white border-gray-700 hover:bg-gray-800"
                  onClick={() => handleMergeFace(face.id)} // Fixed to pass face.id instead of face
                >
                  <Users className="h-4 w-4 mr-2" />
                  Merge
                </Button>
              </div>
              
              <Button
                variant="outline"
                className="w-full mt-2 text-white border-gray-700 hover:bg-gray-800"
                onClick={() => handleViewHistory(face.id)} // Fixed to pass face.id instead of face
              >
                <History className="h-4 w-4 mr-2" />
                View History
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  // Loading or login prompt
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

  // --- MAIN RENDER ---
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4">
      {/* ModelLoader overlays while models load */}
      {!modelsLoaded && (
        <ModelLoader onModelsLoaded={() => setModelsLoaded(true)} />
      )}

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

          <div className="flex space-x-2">
            <Button
              variant="ghost"
              className={`relative ${notifications.length > 0 ? 'text-blue-400' : 'text-white'}`}
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="h-5 w-5" />
              {notifications.filter(n => !n.is_read).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {notifications.filter(n => !n.is_read).length}
                </span>
              )}
            </Button>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              multiple
              className="hidden"
              disabled={!modelsLoaded}
            />
            <Button
              onClick={handleUploadClick}
              className="bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600"
              disabled={isUploading || !modelsLoaded}
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
        
        {/* Notifications panel */}
        {showNotifications && (
          <div className="mb-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <Bell className="h-5 w-5 mr-2" />
              Notifications
            </h2>
            <NotificationsTable 
              notifications={notifications}
              onMarkAsRead={handleMarkAsRead}
              onViewPerson={(personId) => {
                setShowNotifications(false);
                handleViewPersonDetails(personId);
              }}
            />
          </div>
        )}

        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="database">People ({persons.length})</TabsTrigger>
            <TabsTrigger value="local">Local Storage ({localFaces.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="database">
            {renderPersonsList(persons)}
          </TabsContent>

          <TabsContent value="local">
            {renderPersonsList(localFaces)}
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
              onMerge={() => handleMergeFace(editingFace.id)}
              onViewHistory={() => handleViewHistory(editingFace.id)}
            />
          </DialogContent>
        </Dialog>
      )}

      <PersonDetailDialog
        personId={selectedPersonId}
        open={isPersonDetailOpen}
        onOpenChange={setIsPersonDetailOpen}
        onUpdatePerson={loadFaces}
      />
      
      {/* Merge Dialog */}
      <FaceMergeDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        sourceFaceId={selectedFace?.id || null}
        onComplete={loadFaces}
      />
      
      {/* History Dialog */}
      <FaceHistoryDialog
        open={showHistoryDialog}
        onOpenChange={setShowHistoryDialog}
        face={selectedFace}
      />
    </div>
  );
};

export default SavedFaces;
