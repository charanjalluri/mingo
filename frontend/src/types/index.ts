export interface User {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  bio?: string | null;
  is_online: boolean;
  last_seen: string;
  created_at: string;
}

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  user_display_name?: string | null;
  emoji: string;
  created_at: string;
}

export interface MessageReplyTarget {
  id: string;
  sender_id: string;
  sender_display_name: string;
  content?: string | null;
  message_type: 'text' | 'image' | 'voice';
  media_url?: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_username: string;
  sender_display_name: string;
  sender_avatar_url?: string | null;
  content?: string | null;
  message_type: 'text' | 'image' | 'voice';
  media_url?: string | null;
  media_duration?: number | null;
  reply_to_id?: string | null;
  reply_to?: MessageReplyTarget | null;
  reactions: Reaction[];
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  is_online: boolean;
  last_seen: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name?: string | null;
  avatar_url?: string | null;
  unread_count: number;
  last_message?: Message | null;
  participants: ConversationParticipant[];
  updated_at: string;
}

export interface WSEvent {
  type: 'new_message' | 'message_updated' | 'message_deleted' | 'reaction_updated' | 'typing_status' | 'user_presence' | 'read_receipt_update';
  payload: any;
}
