
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

const Profile: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
    
    if (profile) {
      setFullName(profile.full_name || '');
    }
  }, [user, profile, navigate]);

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);
        
      if (error) throw error;
      
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Update failed",
        description: error.message || "There was a problem updating your profile.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black p-4">
      <div className="max-w-3xl mx-auto pt-10">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            className="text-white mr-4"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-5 w-5 mr-1" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-white">Profile Settings</h1>
        </div>
        
        <Card className="bg-black border-gray-800">
          <CardHeader>
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16 border border-gray-700">
                <AvatarImage 
                  src={profile?.avatar_url} 
                  alt={profile?.full_name || user?.email} 
                />
                <AvatarFallback className="bg-gradient-to-r from-green-400 to-blue-500 text-lg">
                  {profile?.full_name ? getInitials(profile.full_name) : user?.email?.[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-white">{profile?.full_name || 'User'}</CardTitle>
                <CardDescription className="text-gray-400">{user?.email}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-gray-300">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-gray-800 border-gray-700 text-gray-400"
                />
                <p className="text-xs text-gray-500">Email cannot be changed</p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-gray-300">Push Notifications</Label>
                <div className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-md p-3">
                  <div>
                    <p className="text-white text-sm font-medium">Browser Notifications</p>
                    <p className="text-gray-400 text-xs">Get notified when faces are recognized</p>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline"
                    className="bg-gray-700 hover:bg-gray-600"
                    onClick={() => requestNotificationPermission()}
                  >
                    Enable
                  </Button>
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 mt-2"
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              variant="outline" 
              className="w-full text-red-400 border-red-800 hover:bg-red-900/20"
              onClick={() => {
                signOut();
                navigate('/');
              }}
            >
              Sign Out
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

// Function to request notification permissions
const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    alert('This browser does not support desktop notifications');
    return;
  }
  
  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // Show a test notification
      new Notification('Notifications Enabled', {
        body: 'You will now receive face recognition alerts',
        icon: '/favicon.ico'
      });
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
  }
};

export default Profile;
