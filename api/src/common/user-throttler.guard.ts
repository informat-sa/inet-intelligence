import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Overrides the default IP-based throttler key with the authenticated user's ID.
 *
 * Why: multiple users in the same office share the same IP. Using IP as the key
 * would cause one user's requests to count against all others on the same network.
 * Using user ID isolates limits per account, which is the correct behavior for
 * a multi-tenant SaaS product.
 *
 * Falls back to IP for unauthenticated requests (e.g. /health, demo login).
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req['user'] as { sub?: string } | undefined;
    if (user?.sub) return `user:${user.sub}`;

    // Respect X-Forwarded-For for reverse-proxy setups, fall back to socket IP
    const forwarded = req['headers'] as Record<string, string> | undefined;
    const ip =
      forwarded?.['x-forwarded-for']?.split(',')[0]?.trim() ??
      (req['ip'] as string | undefined) ??
      'unknown';
    return `ip:${ip}`;
  }

  protected async handleRequest(
    requestProps: Parameters<ThrottlerGuard['handleRequest']>[0],
  ): Promise<boolean> {
    // Skip rate limiting for super_admin — they may need to make many requests
    // for testing and administrative tasks
    const req = requestProps.context.switchToHttp().getRequest();
    if (req.user?.role === 'super_admin') return true;
    return super.handleRequest(requestProps);
  }
}
