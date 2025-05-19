
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DetectedFace, FaceDetectionService } from '@/services/FaceDetectionService';
import { Card, CardContent } from '@/components/ui/card';
import { User, Users } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface FaceMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceFaceId: string | null;
  onComplete: () => void;
}

const FaceMergeDialog: React.FC<FaceMergeDialogProps> = ({ 
  open,
  onOpenChange,
  sourceFaceId,
  onComplete
}) => {
  const { toast } = useToast();
  const [sourceFace, setSourceFace] = useState<DetectedFace | null>(null);
  const [availableFaces, setAvailableFaces] = useState<DetectedFace[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    if (open && sourceFaceId) {
      loadFaces();
    }
  }, [open, sourceFaceId]);

  const loadFaces = async () => {
    setLoading(true);
    try {
      // Load all faces from database
      const faces = await FaceDetectionService.getFacesFromDatabase();
      
      // Find source face
      const source = faces.find(face => face.id === sourceFaceId);
      if (!source) {
        throw new Error("Source face not found");
      }
      
      setSourceFace(source);
      
      // Filter out the source face and faces from the same person
      const targets = faces.filter(face => 
        face.id !== sourceFaceId && 
        (!source.personId || face.personId !== source.personId)
      );
      
      setAvailableFaces(targets);
      
      // Reset selection
      setSelectedTargetId('');
    } catch (error) {
      console.error('Error loading faces:', error);
      toast({
        title: "Error",
        description: "Could not load faces for merging",
        variant: "destructive"
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!sourceFace || !selectedTargetId) return;
    
    setMerging(true);
    try {
      // Find target face
      const targetFace = availableFaces.find(face => face.id === selectedTargetId);
      if (!targetFace) {
        throw new Error("Target face not found");
      }
      
      // Determine which is a person and which is just a face
      let personId: string | null = null;
      let faceId: string | null = null;
      
      if (targetFace.personId) {
        // Target is already a person, merge source into it
        personId = targetFace.personId;
        faceId = sourceFace.id;
      } else if (sourceFace.personId) {
        // Source is already a person, merge target into it
        personId = sourceFace.personId;
        faceId = targetFace.id;
      } else {
        // Neither is a person yet, create a new person from target and add source
        // First create a person from target
        const newPersonId = await FaceDetectionService.createPersonFromFace(targetFace.id);
        personId = newPersonId;
        faceId = sourceFace.id;
      }
      
      // Perform the merge by adding the face to the person
      const success = await FaceDetectionService.addFaceToPerson(faceId, personId!);
      
      if (success) {
        toast({
          title: "Success",
          description: "Faces merged successfully",
        });
        onComplete();
        onOpenChange(false);
      } else {
        throw new Error("Failed to merge faces");
      }
    } catch (error) {
      console.error('Error merging faces:', error);
      toast({
        title: "Error",
        description: `Could not merge faces: ${(error as Error).message}`,
        variant: "destructive"
      });
    } finally {
      setMerging(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Merge Faces</DialogTitle>
          <DialogDescription>
            Select another face to merge with {sourceFace?.name || 'this face'}.
            Merging will group these faces as the same person.
          </DialogDescription>
        </DialogHeader>

        {/* Source face info */}
        {sourceFace && (
          <div className="mb-4 p-3 border rounded-md bg-gray-50 dark:bg-gray-800">
            <h3 className="text-sm font-medium mb-2">Source Face</h3>
            <div className="flex items-center space-x-3">
              {sourceFace.image ? (
                <div className="h-16 w-16 rounded-md overflow-hidden bg-gray-200">
                  <img 
                    src={sourceFace.image} 
                    alt={sourceFace.name || 'Source face'} 
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-md bg-gray-200 flex items-center justify-center">
                  <User className="h-8 w-8 text-gray-400" />
                </div>
              )}
              <div>
                <p className="font-medium">{sourceFace.name || 'Unnamed Face'}</p>
                <p className="text-sm text-gray-500">ID: {sourceFace.id.substring(0, 8)}...</p>
              </div>
            </div>
          </div>
        )}

        {/* Target face selection */}
        <div className="mt-4">
          <h3 className="text-sm font-medium mb-2">Select Target Face</h3>
          
          {availableFaces.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <Users className="mx-auto h-12 w-12 opacity-20 mb-2" />
              <p>No other faces available for merging</p>
            </div>
          ) : (
            <RadioGroup value={selectedTargetId} onValueChange={setSelectedTargetId} className="gap-4">
              {availableFaces.map(face => (
                <div key={face.id} className="flex items-start space-x-2">
                  <RadioGroupItem value={face.id} id={face.id} className="mt-1" />
                  <Label htmlFor={face.id} className="flex-1 cursor-pointer">
                    <Card className="border-2 transition-colors hover:border-primary">
                      <CardContent className="p-3 flex items-center space-x-3">
                        {face.image ? (
                          <div className="h-16 w-16 rounded-md overflow-hidden bg-gray-200">
                            <img 
                              src={face.image} 
                              alt={face.name || 'Target face'} 
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-16 w-16 rounded-md bg-gray-200 flex items-center justify-center">
                            <User className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{face.name || 'Unnamed Face'}</p>
                          <p className="text-sm text-gray-500">ID: {face.id.substring(0, 8)}...</p>
                          {face.personId && (
                            <p className="text-xs text-blue-500 flex items-center mt-1">
                              <Users className="h-3 w-3 mr-1" />
                              Part of a person group
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        </div>

        <div className="flex justify-end space-x-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleMerge} 
            disabled={!selectedTargetId || merging || availableFaces.length === 0}
          >
            {merging ? "Merging..." : "Merge Faces"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FaceMergeDialog;
