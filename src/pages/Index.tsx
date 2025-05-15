
import React from 'react';
import FaceDetectionCamera from '@/components/FaceDetectionCamera';
import FaceRecognitionNotifications from '@/components/notifications/FaceRecognitionNotifications';
import UserProfile from '@/components/UserProfile';

const Index = () => {
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
