
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { formatDistanceToNow, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { FaceDetectionService } from '@/services/FaceDetectionService';
import { DetectedFace } from '@/services/FaceDetectionService';
import { User } from 'lucide-react';

interface FaceHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  face: DetectedFace | null;
}

const FaceHistoryDialog: React.FC<FaceHistoryDialogProps> = ({ 
  open, 
  onOpenChange,
  face
}) => {
  const { toast } = useToast();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (open && face) {
      loadHistory();
    }
  }, [open, face]);
  
  const loadHistory = async () => {
    if (!face) return;
    
    setLoading(true);
    try {
      // Determine if we're looking at a face or a person
      const type = face.personId ? 'person' : 'face';
      const id = face.personId || face.id;
      
      const historyData = await FaceDetectionService.getRecognitionHistory(id, type);
      setHistory(historyData);
    } catch (error) {
      console.error('Error loading history:', error);
      toast({
        title: "Error",
        description: "Could not load recognition history",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!face) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recognition History</DialogTitle>
          <DialogDescription>
            Recent detections of {face.name || 'this face'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4">
          {/* Face info */}
          <div className="flex items-center space-x-3 mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
            {face.image ? (
              <div className="h-16 w-16 rounded-md overflow-hidden bg-gray-200">
                <img 
                  src={face.image} 
                  alt={face.name || 'Face'} 
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
              <p className="text-sm text-gray-500">
                {face.personId ? 'Person Group • ' : ''}
                ID: {face.id.substring(0, 8)}...
              </p>
            </div>
          </div>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No recognition history found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Relative Time</TableHead>
                  <TableHead>Image</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      {format(new Date(event.recognized_at), 'PPp')}
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(event.recognized_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {event.image ? (
                        <div className="h-10 w-10 rounded overflow-hidden bg-gray-200">
                          <img 
                            src={event.image} 
                            alt="Recognition event" 
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">No image</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FaceHistoryDialog;
