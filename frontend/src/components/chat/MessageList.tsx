import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { Message } from '../../types';
import { MessageBubble } from './MessageBubble';
import { DateSeparator } from './DateSeparator';
import { TypingIndicator } from './TypingIndicator';
import { NewMessagesBadge } from './NewMessagesBadge';
import { formatDateDivider } from '../../utils/dateUtils';

interface MessageListProps {
  messages: Message[];
  isGroup: boolean;
  typingUserNames: string[];
  onReply: (msg: Message) => void;
  onReaction: (msgId: string, emoji: string) => void;
  onEdit: (msg: Message) => void;
  onDelete: (msgId: string) => void;
  onOpenImage: (url: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isGroup,
  typingUserNames,
  onReply,
  onReaction,
  onEdit,
  onDelete,
  onOpenImage
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef<boolean>(true);
  const [showNewBadge, setShowNewBadge] = useState<boolean>(false);
  const prevMessagesLengthRef = useRef<number>(messages.length);

  const checkIsAtBottom = () => {
    if (!containerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // 80px threshold
    return scrollHeight - scrollTop - clientHeight < 80;
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const atBottom = checkIsAtBottom();
    isAtBottomRef.current = atBottom;
    if (atBottom) {
      setShowNewBadge(false);
    }
  };

  const scrollToBottom = (smooth = true) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
      setShowNewBadge(false);
    }
  };

  useLayoutEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      if (isAtBottomRef.current) {
        scrollToBottom(false);
      } else {
        setShowNewBadge(true);
      }
    } else {
      // First load or conversation change
      scrollToBottom(false);
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  // Group messages by date and sender sequence
  const renderItems = () => {
    const items: React.ReactNode[] = [];
    let lastDateStr = '';
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    messages.forEach((msg, index) => {
      const dateStr = formatDateDivider(msg.created_at);
      const isNewDate = dateStr !== lastDateStr;

      if (isNewDate) {
        items.push(<DateSeparator key={`date-${msg.id}`} isoString={msg.created_at} />);
        lastDateStr = dateStr;
      }

      const prevMsg = index > 0 ? messages[index - 1] : null;
      const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
      const msgTime = new Date(msg.created_at).getTime();

      const isSameSenderAsPrev = Boolean(
        !isNewDate &&
        prevMsg &&
        prevMsg.sender_id === msg.sender_id &&
        (msgTime - new Date(prevMsg.created_at).getTime() <= FIVE_MINUTES_MS)
      );

      const isNextNewDate = nextMsg ? formatDateDivider(nextMsg.created_at) !== dateStr : true;
      const isSameSenderAsNext = Boolean(
        !isNextNewDate &&
        nextMsg &&
        nextMsg.sender_id === msg.sender_id &&
        (new Date(nextMsg.created_at).getTime() - msgTime <= FIVE_MINUTES_MS)
      );

      let sequencePosition: 'single' | 'first' | 'middle' | 'last' = 'single';
      if (isSameSenderAsPrev && isSameSenderAsNext) {
        sequencePosition = 'middle';
      } else if (!isSameSenderAsPrev && isSameSenderAsNext) {
        sequencePosition = 'first';
      } else if (isSameSenderAsPrev && !isSameSenderAsNext) {
        sequencePosition = 'last';
      }

      items.push(
        <MessageBubble
          key={msg.id}
          message={msg}
          isGroup={isGroup}
          sequencePosition={sequencePosition}
          onReply={onReply}
          onReaction={onReaction}
          onEdit={onEdit}
          onDelete={onDelete}
          onOpenImage={onOpenImage}
        />
      );
    });

    return items;
  };

  return (
    <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          height: '100%',
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {messages.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.88rem'
          }}>
            No messages in this chat yet. Send a message to start! 💬
          </div>
        ) : (
          renderItems()
        )}

        <TypingIndicator userNames={typingUserNames} />
      </div>

      {showNewBadge && (
        <NewMessagesBadge onClick={() => scrollToBottom(true)} />
      )}
    </div>
  );
};
