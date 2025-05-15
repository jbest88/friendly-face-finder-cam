
/// <reference types="vite/client" />

// Add augmentation for face-api.js FaceExpressions to include index signature
declare module 'face-api.js' {
  interface FaceExpressions {
    [key: string]: number;
  }
}
