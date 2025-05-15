
import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';

interface DetectedFace {
  detection: any;
  expressions?: any;
  age?: number;
  gender?: string;
  descriptor?: Float32Array;
  timestamp: Date;
  id: string;
  image?: string;
  name?: string;
  notifyOnRecognition?: boolean;
}

interface SavedFacesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedFaces: DetectedFace[];
}

const SavedFacesDialog: React.FC<SavedFacesDialogProps> = ({ 
  open, 
  onOpenChange, 
  savedFaces 
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Saved Faces</DialogTitle>
          <DialogDescription>
            {savedFaces.length} faces have been saved. In a full system, these would sync to a backend.
          </DialogDescription>
        </DialogHeader>
        
        {savedFaces.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No faces have been saved yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {savedFaces.map((face, index) => (
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SavedFacesDialog;
