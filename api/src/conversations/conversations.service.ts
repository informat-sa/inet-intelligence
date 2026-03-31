import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationMessage } from './entities/conversation-message.entity';

export interface MessageDto {
  id: string;
  role: string;
  content: string;
  modulesUsed?: string[];
  suggestedFollowUps?: string[];
  timestamp: string | Date;
}

export interface UpsertConversationDto {
  title: string;
  modulesUsed?: string[];
  messages: MessageDto[];
}

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
    @InjectRepository(ConversationMessage)
    private readonly msgRepo: Repository<ConversationMessage>,
  ) {}

  async listByUser(userId: string, tenantId: string): Promise<Conversation[]> {
    return this.convRepo.find({
      where: { userId, tenantId },
      order: { updatedAt: 'DESC' },
      select: ['id', 'title', 'modulesUsed', 'messageCount', 'createdAt', 'updatedAt'],
    });
  }

  async upsert(
    userId: string,
    tenantId: string,
    id: string,
    dto: UpsertConversationDto,
  ): Promise<{ id: string }> {
    // Upsert the conversation header
    await this.convRepo.save({
      id,
      userId,
      tenantId,
      title: dto.title,
      modulesUsed: dto.modulesUsed ?? [],
      messageCount: dto.messages.length,
    });

    // Replace all messages (delete + re-insert)
    await this.msgRepo.delete({ conversationId: id });

    if (dto.messages.length > 0) {
      const entities = dto.messages.map((m) =>
        this.msgRepo.create({
          id: m.id,
          conversationId: id,
          role: m.role,
          content: m.content,
          modulesUsed: m.modulesUsed ?? [],
          suggestedFollowUps: m.suggestedFollowUps ?? [],
          timestamp: new Date(m.timestamp),
        }),
      );
      await this.msgRepo.save(entities);
    }

    return { id };
  }

  async getWithMessages(
    userId: string,
    tenantId: string,
    id: string,
  ): Promise<(Conversation & { messages: ConversationMessage[] }) | null> {
    const conv = await this.convRepo.findOne({ where: { id, userId, tenantId } });
    if (!conv) return null;
    const messages = await this.msgRepo.find({
      where: { conversationId: id },
      order: { timestamp: 'ASC' },
    });
    return { ...conv, messages };
  }

  async delete(userId: string, tenantId: string, id: string): Promise<void> {
    await this.convRepo.delete({ id, userId, tenantId });
  }
}
