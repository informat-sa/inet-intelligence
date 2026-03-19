import { Controller, Post, Body, Res, Req, Logger } from '@nestjs/common';
import type { Response, Request } from 'express';
import { IsString, IsOptional } from 'class-validator';
import { QueryService } from './query.service';

class QueryDto {
  @IsString() question: string;
  @IsString() empresaId: string;
  @IsOptional() @IsString() conversationId?: string;
}

@Controller('query')
export class QueryController {
  private readonly logger = new Logger(QueryController.name);

  constructor(private readonly queryService: QueryService) {}

  @Post('stream')
  async streamQuery(@Body() dto: QueryDto, @Res() res: Response, @Req() req: Request) {
    this.logger.log(`[${dto.empresaId}] "${dto.question.slice(0, 80)}"`);

    // Mirror the request origin so SSE works regardless of which port the frontend is on
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
      const stream = this.queryService.streamQuery(dto.question, dto.empresaId);

      for await (const event of stream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if (typeof (res as any).flush === 'function') (res as any).flush();
      }
    } catch (err) {
      this.logger.error('Stream error', err);
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Internal server error' })}\n\n`);
    } finally {
      res.end();
    }
  }
}
