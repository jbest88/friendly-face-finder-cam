
export class CameraManager {
  static async startCamera(
    videoElement: HTMLVideoElement | null,
    facingMode: 'user' | 'environment'
  ): Promise<MediaStream | null> {
    if (!videoElement) return null;
    
    try {
      const constraints: MediaStreamConstraints = {
        video: { facingMode }
      };
      
      const currentStream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = currentStream;
      
      return currentStream;
    } catch (error) {
      console.error('Error accessing camera:', error);
      throw error;
    }
  }
  
  static stopCamera(
    stream: MediaStream | null,
    videoElement: HTMLVideoElement | null
  ): void {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    if (videoElement) {
      videoElement.srcObject = null;
    }
  }
}
