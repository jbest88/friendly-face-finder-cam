
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface FaceRecognitionNotification {
  id: string;
  face_id: string | null;
  face_name: string;
  recognized_at: string;
  image: string | null;
  notes: string | null;
  is_read: boolean;
}

export class NotificationsService {
  private static channel: RealtimeChannel | null = null;
  // Track recently recognized faces to prevent spam (face_id -> timestamp)
  private static recentlyNotifiedFaces: Map<string, number> = new Map();
  // How long to wait before sending another notification for the same face (ms)
  private static NOTIFICATION_COOLDOWN = 60000; // 1 minute

  /**
   * Send a notification when a face is recognized
   */
  static async sendRecognitionNotification(
    faceName: string, 
    faceId?: string, 
    image?: string,
    notes?: string
  ): Promise<boolean> {
    try {
      // If we have a face ID, check if we've recently sent a notification for this face
      if (faceId) {
        const now = Date.now();
        const lastNotified = this.recentlyNotifiedFaces.get(faceId);
        
        if (lastNotified && now - lastNotified < this.NOTIFICATION_COOLDOWN) {
          console.log(`Skipping notification for ${faceName} - cooldown period active`);
          return false;
        }
        
        // Update the timestamp for this face
        this.recentlyNotifiedFaces.set(faceId, now);
        
        // Clean up old entries from the map
        this.cleanupRecentlyNotifiedFaces();
      }
      
      console.log(`Sending recognition notification for ${faceName}`);
      
      const { data, error } = await supabase
        .from('recognition_notifications')
        .insert({
          face_id: faceId || null,
          face_name: faceName,
          image: image || null,
          notes: notes || null
        })
        .select()
        .single();
        
      if (error) {
        console.error('Error sending notification:', error);
        return false;
      }
      
      console.log('Notification sent successfully:', data);
      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }

  /**
   * Clean up old entries from the recentlyNotifiedFaces map
   */
  private static cleanupRecentlyNotifiedFaces(): void {
    const now = Date.now();
    for (const [faceId, timestamp] of this.recentlyNotifiedFaces.entries()) {
      if (now - timestamp > this.NOTIFICATION_COOLDOWN) {
        this.recentlyNotifiedFaces.delete(faceId);
      }
    }
  }

  /**
   * Subscribe to notifications and call the callback when new ones arrive
   */
  static subscribeToNotifications(
    callback: (notification: FaceRecognitionNotification) => void
  ): () => void {
    // Unsubscribe from any existing subscription
    if (this.channel) {
      supabase.removeChannel(this.channel);
    }

    console.log('Subscribing to recognition notifications...');
    
    // Create a new subscription
    this.channel = supabase
      .channel('public:recognition_notifications')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'recognition_notifications' 
        },
        (payload) => {
          console.log('New notification received:', payload);
          const notification = payload.new as FaceRecognitionNotification;
          callback(notification);
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    // Return a function to unsubscribe
    return () => {
      if (this.channel) {
        console.log('Unsubscribing from notifications');
        supabase.removeChannel(this.channel);
        this.channel = null;
      }
    };
  }

  /**
   * Get all unread notifications
   */
  static async getUnreadNotifications(): Promise<FaceRecognitionNotification[]> {
    try {
      const { data, error } = await supabase
        .from('recognition_notifications')
        .select('*')
        .eq('is_read', false)
        .order('recognized_at', { ascending: false });
        
      if (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }
      
      return data as FaceRecognitionNotification[];
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('recognition_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
        
      if (error) {
        console.error('Error updating notification:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error updating notification:', error);
      return false;
    }
  }
}
