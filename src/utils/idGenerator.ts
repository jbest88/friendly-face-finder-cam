
/**
 * Generates a temporary unique ID for faces
 * In a full system, this would be replaced with IDs from the backend
 */
export const generateTemporaryId = (): string => {
  return 'face_' + 
    Date.now().toString(36) + 
    Math.random().toString(36).substr(2, 5);
};
