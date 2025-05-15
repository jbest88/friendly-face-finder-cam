
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FaceDetectionCamera from '@/components/FaceDetectionCamera';
import FaceRecognitionNotifications from '@/components/notifications/FaceRecognitionNotifications';
import UserProfile from '@/components/UserProfile';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  // Redirect unauthenticated users to login page
  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  // Show loading or login prompt if not authenticated
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <p className="text-xl">Loading...</p>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 mb-6">
          Face Recognition App
        </h1>
        <p className="text-center mb-8 max-w-md">
          Please log in or sign up to use the face recognition features.
        </p>
        <div className="flex gap-4">
          <Button 
            onClick={() => navigate('/login')}
            className="bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600"
          >
            Log In
          </Button>
          <Button 
            onClick={() => navigate('/signup')}
            variant="outline"
            className="text-white border-gray-700 hover:bg-gray-800"
          >
            Sign Up
          </Button>
        </div>
      </div>
    );
  }

  // Only render content if authenticated
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4">
      <header className="max-w-3xl mx-auto mb-8">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">
            Face Recognition App
          </h1>
          <div className="flex items-center space-x-4">
            <FaceRecognitionNotifications />
            <UserProfile />
          </div>
        </div>
        <p className="text-gray-300 text-center max-w-xl mx-auto">
          This app uses your device's camera to detect and analyze faces in real-time.
        </p>
      </header>

      <main className="max-w-4xl mx-auto">
        <FaceDetectionCamera />
      </main>
      
      <footer className="mt-16 text-center text-gray-400 text-sm">
        <p>For demonstration purposes only. Privacy-focused: no face data is stored or transmitted.</p>
      </footer>
    </div>
  );
};

export default Index;
