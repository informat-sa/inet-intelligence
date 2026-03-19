// ─── Auth ───────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  empresa: string;
  empresaId: string;
  role: UserRole;
  modules: ModulePermission[];
  avatarUrl?: string;
}

export type UserRole = "admin" | "manager" | "analyst" | "viewer";

export interface ModulePermission {
  prefix: string;
  name: string;
  enabled: boolean;
}

// ─── Chat & Messages ─────────────────────────────────────────────────────────
export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  status?: MessageStatus;
  result?: QueryResult;
  suggestedFollowUps?: string[];
}

export type MessageStatus = "sending" | "streaming" | "done" | "error";

// ─── Query ────────────────────────────────────────────────────────────────────
export interface QueryRequest {
  question: string;
  conversationId?: string;
  empresaId: string;
}

export interface QueryResponse {
  conversationId: string;
  messageId: string;
  answer: string;
  result?: QueryResult;
  modulesUsed: string[];
  suggestedFollowUps?: string[];
  executionMs?: number;
}

export interface QueryResult {
  type: ResultType;
  data?: Record<string, unknown>[];
  columns?: ColumnDef[];
  sql?: string;
  rowCount?: number;
  chartConfig?: ChartConfig;
  summary?: string;
}

export type ResultType = "table" | "chart" | "scalar" | "text" | "error";

export interface ColumnDef {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "currency";
  align?: "left" | "right" | "center";
}

export interface ChartConfig {
  type: "bar" | "line" | "pie" | "area";
  xKey: string;
  yKey: string;
  yLabel?: string;
  xLabel?: string;
}

// ─── Conversation ────────────────────────────────────────────────────────────
export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  modulesUsed: string[];
  empresaId: string;
}

// ─── Modules ─────────────────────────────────────────────────────────────────
export interface ERP_Module {
  prefix: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  tableCount: number;
  attributeCount: number;
  exampleQuestions: string[];
}

// ─── API ─────────────────────────────────────────────────────────────────────
export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

export interface StreamChunk {
  type: "delta" | "result" | "done" | "error";
  delta?: string;
  result?: QueryResult;
  modulesUsed?: string[];
  suggestedFollowUps?: string[];
  error?: string;
}
