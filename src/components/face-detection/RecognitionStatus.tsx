
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DetectedFace } from '@/services/FaceDetectionService';
import { CheckCircle2, HelpCircle } from 'lucide-react';

interface RecognitionStatusProps {
  face: DetectedFace;
}

const RecognitionStatus: React.FC<RecognitionStatusProps> = ({ face }) => {
  if (!face.isRecognized) {
    return (
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="p-3 flex items-center">
          <HelpCircle className="w-5 h-5 text-yellow-500 mr-2" />
          <div>
            <p className="text-sm font-medium text-yellow-700">Unknown Person</p>
            <p className="text-xs text-yellow-600">This person is not in the database</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-green-50 border-green-200">
      <CardContent className="p-3 flex items-center">
        <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />
        <div>
          <p className="text-sm font-medium text-green-700">Recognized: {face.name}</p>
          <p className="text-xs text-green-600">
            {face.similarity ? `Confidence: ${Math.round(face.similarity * 100)}%` : ''}
            {face.notes ? ` • ${face.notes}` : ''}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecognitionStatus;
