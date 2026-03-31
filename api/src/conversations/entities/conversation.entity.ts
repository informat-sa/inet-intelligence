import {
  Entity, PrimaryColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { ConversationMessage } from './conversation-message.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryColumn()
  id: string; // client-generated UUID

  @Column()
  userId: string;

  @Column()
  tenantId: string;

  @Column({ default: 'Nueva consulta' })
  title: string;

  @Column({ type: 'simple-array', nullable: true })
  modulesUsed: string[];

  @Column({ type: 'int', default: 0 })
  messageCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ConversationMessage, (m) => m.conversation, {
    cascade: true,
    eager: false,
  })
  messages: ConversationMessage[];
}
