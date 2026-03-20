// ─── Auth ───────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  empresa: string;        // tenantName (display)
  tenantId: string | null;
  tenantSlug: string | null;
  role: UserRole;
  modules: string[];      // allowedModules from JWT ['VFA','CCC',...]
  avatarUrl?: string;
}

export type UserRole = 'super_admin' | 'admin' | 'user';

// ─── Multi-empresa support ─────────────────────────────────────────────────
export interface AccessibleTenant {
  id:          string;
  slug:        string;
  name:        string;
  logoUrl?:    string | null;
  moduleCount: number;
}

// ─── JWT Payload (mirrored from backend) ─────────────────────────────────────
export interface JwtPayload {
  sub:            string;
  email:          string;
  role:           UserRole;
  tenantId:       string | null;
  tenantSlug:     string | null;
  tenantName:     string | null;
  allowedModules: string[];
  iat?:           number;
  exp?:           number;
}

// ─── Portal Users (Admin panel) ───────────────────────────────────────────────
export interface PortalUser {
  id:               string;
  name:             string;
  email:            string;
  role:             UserRole;
  isActive:         boolean;
  inviteToken?:     string;
  inviteExpiresAt?: string;
  lastLoginAt?:     string;
  createdAt:        string;
  modulePermissions: { modulePrefix: string; enabled: boolean }[];
}

// ─── Tenant ───────────────────────────────────────────────────────────────────
export interface Tenant {
  id:             string;
  slug:           string;
  name:           string;
  taxId?:         string;
  logoUrl?:       string;
  enabledModules: string[];
  isActive:       boolean;
  createdAt:      string;
}

// ─── Favorites ────────────────────────────────────────────────────────────────
export interface Favorite {
  id:          string;
  title:       string;
  question:    string;
  modulesHint: string[];
  createdAt:   string;
}

// ─── Chat & Messages ─────────────────────────────────────────────────────────
export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id:                string;
  role:              MessageRole;
  content:           string;
  timestamp:         Date;
  status?:           MessageStatus;
  result?:           QueryResult;
  suggestedFollowUps?: string[];
}

export type MessageStatus = 'sending' | 'streaming' | 'done' | 'error';

// ─── Query ────────────────────────────────────────────────────────────────────
export interface QueryRequest {
  question:        string;
  conversationId?: string;
  // empresaId removed — now comes from JWT
}

export interface QueryResponse {
  conversationId:    string;
  messageId:         string;
  answer:            string;
  result?:           QueryResult;
  modulesUsed:       string[];
  suggestedFollowUps?: string[];
  executionMs?:      number;
}

export interface QueryResult {
  type:         ResultType;
  data?:        Record<string, unknown>[];
  columns?:     ColumnDef[];
  sql?:         string;
  rowCount?:    number;
  chartConfig?: ChartConfig;
  summary?:     string;
}

export type ResultType = 'table' | 'chart' | 'scalar' | 'text' | 'error';

export interface ColumnDef {
  key:    string;
  label:  string;
  type:   'string' | 'number' | 'date' | 'currency';
  align?: 'left' | 'right' | 'center';
}

export interface ChartConfig {
  type:    'bar' | 'line' | 'pie' | 'area';
  xKey:    string;
  yKey:    string;
  yLabel?: string;
  xLabel?: string;
}

// ─── Conversation ────────────────────────────────────────────────────────────
export interface Conversation {
  id:           string;
  title:        string;
  createdAt:    Date;
  updatedAt:    Date;
  messageCount: number;
  modulesUsed:  string[];
  // empresaId removed — scoped to user via JWT
}

// ─── Modules ─────────────────────────────────────────────────────────────────
export interface ERP_Module {
  prefix:           string;
  name:             string;
  description:      string;
  icon:             string;
  color:            string;
  tableCount:       number;
  attributeCount:   number;
  exampleQuestions: string[];
}

// ─── API ─────────────────────────────────────────────────────────────────────
export interface ApiError {
  message:    string;
  statusCode: number;
  error?:     string;
}

export interface StreamChunk {
  type:               'delta' | 'result' | 'done' | 'error';
  delta?:             string;
  result?:            QueryResult;
  modulesUsed?:       string[];
  suggestedFollowUps?: string[];
  error?:             string;
}
