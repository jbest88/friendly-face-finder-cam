
import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { DetectedFace, FaceDetectionService } from '@/services/FaceDetectionService';
import FaceEditor from './FaceEditor';

interface SavedFacesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedFaces: DetectedFace[];
  onUpdateFaces?: () => void;
}

const SavedFacesDialog: React.FC<SavedFacesDialogProps> = ({ 
  open, 
  onOpenChange, 
  savedFaces: localSavedFaces,
  onUpdateFaces
}) => {
  const { toast } = useToast();
  const [databaseFaces, setDatabaseFaces] = useState<DetectedFace[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFace, setEditingFace] = useState<DetectedFace | null>(null);
  const [activeTab, setActiveTab] = useState<string>("database");
  
  const fetchDatabaseFaces = async () => {
    setLoading(true);
    try {
      const faces = await FaceDetectionService.getFacesFromDatabase();
      setDatabaseFaces(faces);
    } catch (error) {
      console.error('Error fetching faces:', error);
      toast({
        title: "Error",
        description: "Could not load saved faces from database",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Load faces when dialog opens
  useEffect(() => {
    if (open) {
      fetchDatabaseFaces();
    }
  }, [open]);
  
  const handleSaveFace = async (updatedFace: DetectedFace) => {
    try {
      const success = await FaceDetectionService.updateFaceInDatabase(updatedFace);
      
      if (success) {
        toast({
          title: "Success",
          description: `Updated information for ${updatedFace.name}`,
        });
        
        // Refresh the faces list
        fetchDatabaseFaces();
        setEditingFace(null);
        if (onUpdateFaces) onUpdateFaces();
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
        fetchDatabaseFaces();
        setEditingFace(null);
        if (onUpdateFaces) onUpdateFaces();
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
  
  const renderFacesList = (faces: DetectedFace[]) => {
    if (loading) {
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
              <Button 
                variant="outline" 
                className="w-full mt-2"
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Saved Faces</DialogTitle>
            <DialogDescription>
              {databaseFaces.length} faces in database. Click on a face to edit details.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="database">Database ({databaseFaces.length})</TabsTrigger>
              <TabsTrigger value="local">Local Storage ({localSavedFaces.length})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="database">
              {renderFacesList(databaseFaces)}
            </TabsContent>
            
            <TabsContent value="local">
              {renderFacesList(localSavedFaces)}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      
      {editingFace && (
        <Dialog open={!!editingFace} onOpenChange={(open) => !open && setEditingFace(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Face</DialogTitle>
            </DialogHeader>
            <FaceEditor 
              face={editingFace} 
              onSave={handleSaveFace} 
              onDelete={handleDeleteFace} 
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default SavedFacesDialog;
