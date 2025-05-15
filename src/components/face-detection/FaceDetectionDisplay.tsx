
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface FaceExpressions {
  [key: string]: number;
}

interface DetectedFace {
  detection: any;
  expressions?: FaceExpressions;
  age?: number;
  gender?: string;
  descriptor?: Float32Array;
  timestamp: Date;
  id: string;
  image?: string;
  name?: string;
  notifyOnRecognition?: boolean;
}

interface FaceDetectionDisplayProps {
  detectedFaces: DetectedFace[];
}

const FaceDetectionDisplay: React.FC<FaceDetectionDisplayProps> = ({ detectedFaces }) => {
  return (
    <div className="w-full">
      <h2 className="text-xl font-bold mb-4 text-center">
        {detectedFaces.length === 0 
          ? "No faces detected" 
          : `Detected ${detectedFaces.length} ${detectedFaces.length === 1 ? 'face' : 'faces'}`}
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {detectedFaces.map((face, index) => (
          <Card key={index} className="overflow-hidden border border-green-500/30 animate-pulse-glow">
            <CardContent className="p-4">
              <h3 className="font-medium text-lg mb-2">Face {index + 1}</h3>
              
              {face.age && (
                <p className="text-sm mb-1">
                  <span className="font-medium">Age:</span> {Math.round(face.age)} years
                </p>
              )}
              
              {face.gender && (
                <p className="text-sm mb-1">
                  <span className="font-medium">Gender:</span> {face.gender}
                </p>
              )}
              
              {face.expressions && (
                <div className="mt-2">
                  <p className="text-sm font-medium mb-1">Expression:</p>
                  <div className="space-y-1">
                    {Object.entries(face.expressions)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([expression, probability]) => (
                        <div key={expression} className="flex items-center">
                          <div className="w-24 text-xs">{expression}</div>
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-green-500 h-full rounded-full" 
                              style={{ width: `${probability * 100}%` }}
                            />
                          </div>
                          <div className="w-12 text-right text-xs">
                            {Math.round(probability * 100)}%
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default FaceDetectionDisplay;
