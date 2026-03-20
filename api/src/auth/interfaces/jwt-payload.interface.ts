export interface JwtPayload {
  sub: string;            // user UUID
  email: string;
  role: 'super_admin' | 'admin' | 'user';
  tenantId: string | null;    // null for super_admin
  tenantSlug: string | null;
  tenantName: string | null;
  allowedModules: string[];   // ['VFA','CCC','EXI'] — enforced by QueryService
  iat?: number;
  exp?: number;
}
