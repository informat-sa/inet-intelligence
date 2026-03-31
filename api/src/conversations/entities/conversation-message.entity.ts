import {
  Entity, PrimaryColumn, Column, ManyToOne, JoinColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity('conversation_messages')
export class ConversationMessage {
  @PrimaryColumn()
  id: string; // client-generated UUID

  @Column()
  conversationId: string;

  @ManyToOne(() => Conversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @Column({ length: 16 })
  role: string; // 'user' | 'assistant'

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'simple-array', nullable: true })
  modulesUsed: string[];

  @Column({ type: 'simple-array', nullable: true })
  suggestedFollowUps: string[];

  @Column({ type: 'timestamp with time zone' })
  timestamp: Date;
}
