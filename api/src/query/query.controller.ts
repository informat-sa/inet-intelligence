import { Controller, Post, Get, Body, Res, Req, Query, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response, Request } from 'express';
import { IsString, IsOptional, IsArray, IsIn, Matches, MinLength, MaxLength, ArrayMaxSize } from 'class-validator';
import { QueryService } from './query.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

class HistoryMessage {
  @IsString() @MinLength(1) @MaxLength(600) content: string;
  // Validate role strictly — prevents "system" role injection into Claude
  @IsIn(['user', 'assistant']) role: 'user' | 'assistant';
}

class QueryDto {
  @IsString()
  @MinLength(2, { message: 'La pregunta es demasiado corta' })
  @MaxLength(800, { message: 'La pregunta no puede superar los 800 caracteres' })
  question: string;

  @IsOptional() @IsString() conversationId?: string;

  /** Module prefixes must be 2–5 uppercase letters (e.g. "VFA", "CON") */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @Matches(/^[A-Z]{2,5}$/, { each: true, message: 'forcedModules: solo se permiten prefijos de módulo válidos (2-5 letras mayúsculas)' })
  forcedModules?: string[];

  /** Last N messages for conversational context — lets Claude understand follow-ups */
  @IsOptional() @IsArray() @ArrayMaxSize(10) history?: HistoryMessage[];
}

@Controller('query')
export class QueryController {
  private readonly logger = new Logger(QueryController.name);

  constructor(private readonly queryService: QueryService) {}

  @Get('kpis')
  async getKpis(
    @CurrentUser() jwtUser: JwtPayload,
    @Query('year')  year?:  string,
    @Query('month') month?: string,
  ) {
    const y = year  ? parseInt(year,  10) : undefined;
    const m = month ? parseInt(month, 10) : undefined;
    return this.queryService.getKpis(jwtUser, y, m);
  }

  // Stricter rate limits for /query/stream — every request costs Anthropic API tokens
  // default: 20/min sustained  |  burst: 3 per 10s (prevents rapid-fire spam)
  @Throttle({ default: { ttl: 60_000, limit: 20 }, burst: { ttl: 10_000, limit: 3 } })
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
      const stream = this.queryService.streamQuery(dto.question, jwtUser, dto.forcedModules, dto.history);

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
