
/// <reference types="vite/client" />

// Add augmentation for face-api.js to include missing types
declare module 'face-api.js' {
  interface FaceExpressions {
    [key: string]: number;
  }

  // Add missing properties to the namespace
  const nets: {
    tinyFaceDetector: {
      loadFromUri: (url: string) => Promise<void>;
    };
    faceLandmark68Net: {
      loadFromUri: (url: string) => Promise<void>;
    };
    faceExpressionNet: {
      loadFromUri: (url: string) => Promise<void>;
    };
    ageGenderNet: {
      loadFromUri: (url: string) => Promise<void>;
    };
    faceRecognitionNet: {
      loadFromUri: (url: string) => Promise<void>;
    };
  };

  // Fix the TinyFaceDetectorOptions class to properly accept configuration options
  class TinyFaceDetectorOptions {
    constructor(options: { inputSize: number });
    // Alternative constructor method
    static fromParams(inputSize: number, scoreThreshold?: number): TinyFaceDetectorOptions;
  }

  interface FaceDetection {}

  function matchDimensions(canvas: HTMLCanvasElement, dimensions: { width: number; height: number }): void;
  function detectAllFaces(input: HTMLVideoElement | HTMLImageElement, options: any): any;
  function resizeResults(results: any, dimensions: { width: number; height: number }): any;
  
  const draw: {
    drawDetections(canvas: HTMLCanvasElement, detections: any): void;
    drawFaceLandmarks(canvas: HTMLCanvasElement, landmarks: any): void;
  };
}
