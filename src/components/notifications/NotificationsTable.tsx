
import React from 'react';
import { FaceRecognitionNotification } from '@/services/NotificationsService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Bell, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationsTableProps {
  notifications: FaceRecognitionNotification[];
  onMarkAsRead: (id: string) => void;
  onViewPerson?: (personId: string) => void;
}

const NotificationsTable: React.FC<NotificationsTableProps> = ({
  notifications,
  onMarkAsRead,
  onViewPerson
}) => {
  if (notifications.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <Bell className="mx-auto h-12 w-12 opacity-20 mb-2" />
        <p>No new notifications</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {notifications.map(notification => (
            <TableRow key={notification.id} className={notification.is_read ? 'opacity-60' : ''}>
              <TableCell className="font-medium">
                <div className="flex items-center space-x-3">
                  {notification.image ? (
                    <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200">
                      <img 
                        src={notification.image} 
                        alt={notification.face_name} 
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="h-6 w-6 text-gray-500" />
                    </div>
                  )}
                  <span>{notification.face_name}</span>
                </div>
              </TableCell>
              <TableCell>
                {formatDistanceToNow(new Date(notification.recognized_at), { addSuffix: true })}
              </TableCell>
              <TableCell>
                {notification.is_read ? (
                  <span className="text-gray-500">Read</span>
                ) : (
                  <span className="text-blue-500 font-medium">New</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {notification.face_id && onViewPerson && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onViewPerson(notification.face_id!)}
                    >
                      <User className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  )}
                  {!notification.is_read && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onMarkAsRead(notification.id)}
                    >
                      Mark as read
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default NotificationsTable;
