import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { BcentralService } from './bcentral.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('bcentral')
@UseGuards(JwtAuthGuard)
export class BcentralController {
  constructor(private readonly svc: BcentralService) {}

  /** GET /bcentral/parametros — valores vigentes */
  @Get('parametros')
  getParametros() {
    return this.svc.getParametros() ?? { error: 'Parámetros aún no disponibles' };
  }

  /** POST /bcentral/actualizar — fuerza refresh manual (solo admin) */
  @Post('actualizar')
  async actualizar() {
    await this.svc.actualizarParametros();
    return { ok: true, data: this.svc.getParametros() };
  }
}
