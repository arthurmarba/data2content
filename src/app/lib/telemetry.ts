import { trace, Span, SpanStatusCode } from '@opentelemetry/api';
import { logger } from './logger';

interface Labels { [key: string]: string; }

class Counter {
  private data = new Map<string, number>();
  inc(labels: Labels, value = 1): void {
    const key = JSON.stringify(labels);
    this.data.set(key, (this.data.get(key) ?? 0) + value);
  }
  get(labels: Labels): number {
    const key = JSON.stringify(labels);
    return this.data.get(key) ?? 0;
  }
}

class Histogram {
  private data = new Map<string, number[]>();
  observe(labels: Labels, value: number): void {
    const key = JSON.stringify(labels);
    const arr = this.data.get(key) || [];
    arr.push(value);
    this.data.set(key, arr);
  }
  get(labels: Labels): number[] {
    const key = JSON.stringify(labels);
    return this.data.get(key) || [];
  }
}

class Gauge {
  private data = new Map<string, number>();
  set(labels: Labels, value: number): void {
    const key = JSON.stringify(labels);
    this.data.set(key, value);
  }
  get(labels: Labels): number {
    const key = JSON.stringify(labels);
    return this.data.get(key) ?? 0;
  }
}

export const metrics = {
  affiliates_webhook_total: new Counter(),
  affiliates_commission_created_total: new Counter(),
  affiliates_mature_promoted_total: new Counter(),
  affiliates_refund_events_total: new Counter(),
  affiliates_redeem_requests_total: new Counter(),
  affiliates_transfers_total: new Counter(),
  affiliates_webhook_duration_ms: new Histogram(),
  affiliates_mature_run_duration_ms: new Histogram(),
  affiliates_transfer_create_duration_ms: new Histogram(),
  affiliates_pending_count: new Gauge(),
  affiliates_balance_sum_cents: new Gauge(),
  affiliates_debt_sum_cents: new Gauge(),
};

const baseFields = {
  env: process.env.NODE_ENV || 'dev',
  service: 'affiliates',
  version: process.env.GIT_SHA || 'local',
};

export function logAffiliateEvent(event: string, data: Record<string, unknown>): void {
  logger.info({ ...baseFields, event, ...data });
}

export function startAffiliateSpan(name: string, attrs?: Record<string, unknown>): Span {
  const tracer = trace.getTracer('affiliates');
  return tracer.startSpan(name, { attributes: { ...baseFields, ...(attrs || {}) } });
}

export { SpanStatusCode } from '@opentelemetry/api';
