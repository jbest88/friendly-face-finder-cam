
import React from 'react';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, SwitchCamera, ArrowUp } from 'lucide-react';

interface CameraControlsProps {
  isCameraActive: boolean;
  facingMode: 'user' | 'environment';
  hasFacesToSave: boolean;
  onStartCamera: () => void;
  onStopCamera: () => void;
  onSwitchCamera: () => void;
  onCaptureFace: () => void;
  onViewSaved: () => void;
  savedCount: number;
}

const CameraControls: React.FC<CameraControlsProps> = ({
  isCameraActive,
  facingMode,
  hasFacesToSave,
  onStartCamera,
  onStopCamera,
  onSwitchCamera,
  onCaptureFace,
  onViewSaved,
  savedCount,
}) => {
  if (!isCameraActive) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/75">
        <Button 
          onClick={onStartCamera} 
          className="bg-green-500 hover:bg-green-600"
        >
          <Camera className="mr-2 h-4 w-4" />
          Start Camera
        </Button>
      </div>
    );
  }

  return (
    <div className="flex space-x-4 mb-6">
      <Button 
        onClick={onStopCamera} 
        variant="destructive" 
      >
        <CameraOff className="mr-2 h-4 w-4" />
        Stop Camera
      </Button>
      
      <Button
        onClick={onSwitchCamera}
        variant="outline"
        className="border-green-500 text-green-500 hover:bg-green-500/10"
      >
        <SwitchCamera className="mr-2 h-4 w-4" />
        Switch Camera ({facingMode === 'user' ? 'Front' : 'Back'})
      </Button>
      
      <Button 
        onClick={onCaptureFace}
        className="bg-green-500 hover:bg-green-600"
        disabled={!hasFacesToSave}
      >
        <ArrowUp className="mr-2 h-4 w-4" />
        Save Face
      </Button>
      
      <Button 
        onClick={onViewSaved}
        variant="outline"
        className="border-green-500 text-green-500 hover:bg-green-500/10"
      >
        View Saved ({savedCount})
      </Button>
    </div>
  );
};

export default CameraControls;
