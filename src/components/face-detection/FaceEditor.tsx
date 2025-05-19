
import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { DetectedFace } from '@/services/FaceDetectionService';
import { ImagePlus, Trash2, Users, History } from 'lucide-react';

interface FaceEditorProps {
  face: DetectedFace;
  onSave: (updatedFace: DetectedFace) => void;
  onDelete: (faceId: string) => void;
  onAddImage?: (personId: string) => void;
  onMerge?: (faceId: string) => void;
  onViewHistory?: (faceId: string) => void;
}

const FaceEditor: React.FC<FaceEditorProps> = ({ 
  face, 
  onSave, 
  onDelete, 
  onAddImage,
  onMerge,
  onViewHistory
}) => {
  const [name, setName] = React.useState(face.name || 'Unknown');
  const [notes, setNotes] = React.useState(face.notes || '');
  const [notifyOnRecognition, setNotifyOnRecognition] = React.useState(face.notifyOnRecognition || false);
  
  const handleSave = () => {
    const updatedFace = {
      ...face,
      name,
      notes,
      notifyOnRecognition
    };
    onSave(updatedFace);
  };
  
  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this face?')) {
      onDelete(face.id);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Edit Face Information</span>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleDelete}
            className="h-8 w-8 p-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter a name"
          />
        </div>
        
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this person"
            className="min-h-[100px]"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="notify"
            checked={notifyOnRecognition}
            onCheckedChange={setNotifyOnRecognition}
          />
          <Label htmlFor="notify">Notify when recognized</Label>
        </div>
        
        {/* Advanced operations section */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium mb-2">Advanced Operations</h4>
          
          <div className="grid grid-cols-1 gap-2">
            {face.personId && onAddImage && (
              <Button 
                onClick={() => onAddImage(face.personId!)} 
                variant="outline"
                className="w-full"
              >
                <ImagePlus className="h-4 w-4 mr-2" />
                Add More Images
              </Button>
            )}
            
            {onMerge && (
              <Button 
                onClick={() => onMerge(face.id)} 
                variant="outline"
                className="w-full"
              >
                <Users className="h-4 w-4 mr-2" />
                Merge with Another Face
              </Button>
            )}
            
            {onViewHistory && (
              <Button 
                onClick={() => onViewHistory(face.id)} 
                variant="outline"
                className="w-full"
              >
                <History className="h-4 w-4 mr-2" />
                View Recognition History
              </Button>
            )}
          </div>
        </div>
        
        {/* Face analysis data */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium mb-2">Face Analysis</h4>
          
          {face.age && (
            <div className="text-sm text-gray-500">
              <p><span className="font-medium">Estimated Age:</span> ~{Math.round(face.age)} years</p>
            </div>
          )}
          
          {face.gender && (
            <div className="text-sm text-gray-500">
              <p><span className="font-medium">Predicted Gender:</span> {face.gender}</p>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} className="w-full">
          Save Information
        </Button>
      </CardFooter>
    </Card>
  );
};

export default FaceEditor;
