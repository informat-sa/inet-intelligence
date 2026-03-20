import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

class CreateFavoriteDto {
  @IsString() title: string;
  @IsString() question: string;
  @IsOptional() @IsString() modulesHint?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.favoritesService.findByUser(user.sub);
  }

  @Post()
  create(@Body() dto: CreateFavoriteDto, @CurrentUser() user: JwtPayload) {
    return this.favoritesService.create(user.sub, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.favoritesService.delete(id, user.sub);
  }
}
