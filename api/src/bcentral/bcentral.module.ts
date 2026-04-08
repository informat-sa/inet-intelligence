import { Module } from '@nestjs/common';
import { BcentralService } from './bcentral.service';
import { BcentralController } from './bcentral.controller';

@Module({
  providers:   [BcentralService],
  controllers: [BcentralController],
  exports:     [BcentralService],
})
export class BcentralModule {}
