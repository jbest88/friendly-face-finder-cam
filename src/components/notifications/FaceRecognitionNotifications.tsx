
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellRing, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { NotificationsService, FaceRecognitionNotification } from '@/services/NotificationsService';
import { ScrollArea } from '@/components/ui/scroll-area';

const FaceRecognitionNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<FaceRecognitionNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const { toast } = useToast();

  // Fetch unread notifications on component mount
  useEffect(() => {
    loadNotifications();
    
    // Subscribe to real-time notifications
    const unsubscribe = NotificationsService.subscribeToNotifications((notification) => {
      console.log('New notification received in component:', notification);
      
      // Add the new notification to the list
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Show a toast notification (only show if the panel isn't already open)
      // This prevents duplicate toasts when the user is already looking at notifications
      if (!showNotifications) {
        toast({
          title: `🔔 ${notification.face_name} recognized!`,
          description: notification.notes || 'Person detected by camera',
        });
        
        // Show browser notification if permissions are granted
        showBrowserNotification(notification);
      }
    });
    
    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, [toast, showNotifications]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const unreadNotifications = await NotificationsService.getUnreadNotifications();
      console.log('Loaded notifications:', unreadNotifications.length);
      setNotifications(unreadNotifications);
      setUnreadCount(unreadNotifications.length);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast({
        title: 'Error loading notifications',
        description: 'Could not fetch notifications from the server',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const success = await NotificationsService.markAsRead(notificationId);
      if (success) {
        // Update local state
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId ? { ...n, is_read: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const promises = notifications
        .filter(n => !n.is_read)
        .map(n => NotificationsService.markAsRead(n.id));
      
      await Promise.all(promises);
      
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      
      toast({
        title: 'All notifications marked as read',
        description: `${promises.length} notifications updated`,
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast({
        title: 'Error updating notifications',
        description: 'Could not mark all notifications as read',
        variant: 'destructive'
      });
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', { 
      hour: 'numeric', 
      minute: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };
  
  // Function to show browser notifications
  const showBrowserNotification = (notification: FaceRecognitionNotification) => {
    // Check if browser supports notifications and permission is granted
    if (!('Notification' in window)) {
      return;
    }
    
    if (Notification.permission === 'granted') {
      const notificationOptions: NotificationOptions = {
        body: notification.notes || `Person detected at ${new Date().toLocaleTimeString()}`,
        icon: notification.image || '/favicon.ico',
        tag: notification.id // Prevents duplicate notifications
      };
      
      new Notification(`${notification.face_name} recognized!`, notificationOptions);
    }
    // Don't request permissions here - we'll do that in the profile settings
  };

  return (
    <div className="relative">
      {/* Notification bell button with badge */}
      <Button
        onClick={() => setShowNotifications(!showNotifications)}
        variant="outline"
        size="icon"
        className="relative"
        aria-label={`${unreadCount} unread notifications`}
      >
        {unreadCount > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        {unreadCount > 0 && (
          <Badge 
            className="absolute -top-2 -right-2 px-1 min-w-[1.25rem] h-5 flex items-center justify-center"
            variant="destructive"
          >
            {unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notifications dropdown panel */}
      {showNotifications && (
        <Card className="absolute right-0 top-full mt-2 w-[350px] max-w-[90vw] z-50 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>Notifications</CardTitle>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                  <Check className="h-4 w-4 mr-1" /> Mark all read
                </Button>
              )}
            </div>
            <CardDescription>
              Face recognition alerts
            </CardDescription>
          </CardHeader>
          
          <ScrollArea className="h-[300px]">
            {loading ? (
              <div className="flex justify-center items-center h-20">
                <p className="text-sm text-muted-foreground">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex justify-center items-center h-20">
                <p className="text-sm text-muted-foreground">No new notifications</p>
              </div>
            ) : (
              <CardContent className="space-y-2">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id}
                    className={`p-3 rounded-md flex flex-col ${
                      notification.is_read ? 'bg-background' : 'bg-accent'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium">
                            {notification.face_name}
                          </h4>
                          {!notification.is_read && (
                            <Badge variant="outline" className="text-xs">New</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(notification.recognized_at)}
                        </p>
                        {notification.notes && (
                          <p className="text-sm mt-1">{notification.notes}</p>
                        )}
                      </div>
                      
                      {notification.image && (
                        <div className="h-12 w-12 rounded overflow-hidden flex-shrink-0">
                          <img 
                            src={notification.image} 
                            alt={notification.face_name} 
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                    
                    {!notification.is_read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <Check className="h-3 w-3 mr-1" /> Mark as read
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            )}
          </ScrollArea>
          
          <CardFooter className="pt-2 flex justify-between">
            <Button variant="outline" size="sm" onClick={() => setShowNotifications(false)}>
              Close
            </Button>
            <Button variant="ghost" size="sm" onClick={loadNotifications}>
              Refresh
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

export default FaceRecognitionNotifications;
