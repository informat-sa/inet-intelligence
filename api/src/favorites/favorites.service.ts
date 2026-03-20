import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favRepo: Repository<Favorite>,
  ) {}

  async findByUser(userId: string): Promise<Favorite[]> {
    return this.favRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(userId: string, data: { title: string; question: string; modulesHint?: string }): Promise<Favorite> {
    const fav = this.favRepo.create({ userId, ...data });
    return this.favRepo.save(fav);
  }

  async delete(id: string, userId: string): Promise<void> {
    const fav = await this.favRepo.findOne({ where: { id, userId } });
    if (!fav) throw new NotFoundException('Favorito no encontrado');
    await this.favRepo.remove(fav);
  }
}
