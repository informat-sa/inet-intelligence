import { Controller, Post, Body, Res, Req, Logger } from '@nestjs/common';
import type { Response, Request } from 'express';
import { IsString, IsOptional, IsArray } from 'class-validator';
import { QueryService } from './query.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

class QueryDto {
  @IsString() question: string;
  @IsOptional() @IsString() conversationId?: string;
  /** When set, bypass auto-detection and use exactly these module prefixes */
  @IsOptional() @IsArray() forcedModules?: string[];
}

@Controller('query')
export class QueryController {
  private readonly logger = new Logger(QueryController.name);

  constructor(private readonly queryService: QueryService) {}

  @Post('stream')
  async streamQuery(
    @Body() dto: QueryDto,
    @CurrentUser() jwtUser: JwtPayload,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const tenantLabel = jwtUser?.tenantSlug ?? 'demo';
    this.logger.log(`[${tenantLabel}][${jwtUser?.email ?? 'anon'}] "${dto.question.slice(0, 80)}"`);

    // Mirror request origin for SSE to work across ports
    const origin = req.headers.origin as string | undefined;
    const allowedOrigin =
      origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
        ? origin
        : (process.env.WEB_URL ?? 'http://localhost:3000');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.flushHeaders();

    try {
      const stream = this.queryService.streamQuery(dto.question, jwtUser, dto.forcedModules);

      for await (const event of stream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if (typeof (res as any).flush === 'function') (res as any).flush();
      }
    } catch (err) {
      this.logger.error('Stream error', err);
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Error interno del servidor' })}\n\n`);
    } finally {
      res.end();
    }
  }
}
