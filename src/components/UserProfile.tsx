
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';

const UserProfile: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  
  const getInitials = (name: string) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };
  
  if (!user) {
    return (
      <div className="flex space-x-2">
        <Button 
          variant="outline" 
          className="text-white border-gray-700 hover:bg-gray-800"
          onClick={() => navigate('/login')}
        >
          Log In
        </Button>
        <Button 
          className="bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600"
          onClick={() => navigate('/signup')}
        >
          Sign Up
        </Button>
      </div>
    );
  }
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10 border border-gray-700">
            <AvatarImage 
              src={profile?.avatar_url} 
              alt={profile?.full_name || user.email} 
            />
            <AvatarFallback className="bg-gradient-to-r from-green-400 to-blue-500">
              {profile?.full_name ? getInitials(profile.full_name) : user.email?.[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-56 bg-gray-900 border-gray-700 text-white" align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="font-medium">{profile?.full_name || 'User'}</p>
            <p className="text-sm text-gray-400">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-700" />
        <DropdownMenuItem 
          className="cursor-pointer hover:bg-gray-800"
          onClick={() => navigate('/profile')}
        >
          Profile Settings
        </DropdownMenuItem>
        <DropdownMenuItem 
          className="cursor-pointer hover:bg-gray-800"
          onClick={() => navigate('/saved-faces')}
        >
          My Saved Faces
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-gray-700" />
        <DropdownMenuItem 
          className="cursor-pointer text-red-400 hover:bg-gray-800 hover:text-red-300"
          onClick={() => signOut()}
        >
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserProfile;
