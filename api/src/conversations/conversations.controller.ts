import {
  Controller, Get, Put, Delete,
  Param, Body, UseGuards,
} from '@nestjs/common';
import { IsString, IsArray, IsOptional, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ConversationsService } from './conversations.service';

class MessageDto {
  @IsString() id: string;
  @IsString() role: string;
  @IsString() content: string;
  @IsOptional() @IsArray() modulesUsed?: string[];
  @IsOptional() @IsArray() suggestedFollowUps?: string[];
  @IsString() timestamp: string;
}

class UpsertConversationDto {
  @IsString() title: string;
  @IsOptional() @IsArray() modulesUsed?: string[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => MessageDto) messages: MessageDto[];
}

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly svc: ConversationsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.svc.listByUser(user.sub, user.tenantId!);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.getWithMessages(user.sub, user.tenantId!, id);
  }

  @Put(':id')
  upsert(
    @Param('id') id: string,
    @Body() dto: UpsertConversationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.upsert(user.sub, user.tenantId!, id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.delete(user.sub, user.tenantId!, id);
  }
}
