// src/utils/getClientIp.ts
import { NextRequest } from 'next/server';
import type { IncomingMessage } from 'http';

/**
 * Ordem de candidatos — cobre Vercel, Cloudflare, proxies comuns e RFC 7239.
 */
const CANDIDATE_HEADERS = [
  'x-vercel-ip',           // Vercel
  'cf-connecting-ip',      // Cloudflare
  'x-forwarded-for',       // Proxies em geral
  'x-forwarded-client-ip', // Alguns proxies
  'x-original-forwarded-for',
  'x-real-ip',             // Nginx/Ingress
  'true-client-ip',        // Akamai
  'fastly-client-ip',      // Fastly
  'fly-client-ip',         // Fly.io
  'x-client-ip',
  'x-cluster-client-ip',
  'forwarded',             // RFC 7239
] as const;

function stripPort(ip?: string | null): string {
  const raw = (ip ?? '').trim();
  if (!raw) return '';
  // IPv4 com porta: "1.2.3.4:5678" -> "1.2.3.4"
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(raw)) {
    return (raw.split(':')[0] ?? '').trim();
  }
  // IPv6 com colchetes e porta: "[2001:db8::1]:443" -> "2001:db8::1"
  const m = raw.match(/^\[([^[\]]+)\](?::\d+)?$/);
  if (m && m[1]) return m[1];
  return raw;
}

function cleanToken(token?: string | null): string {
  const s = (token ?? '').toString();
  // remove aspas e colchetes que alguns proxies colocam
  return s.replace(/^"+|"+$/g, '').replace(/^\[+|\]+$/g, '').trim();
}

function parseForwardedHeader(forwarded: string): string | null {
  // Ex.: for=192.0.2.43, for="[2001:db8:cafe::17]";proto=https;by=203.0.113.43
  const parts = forwarded.split(',');
  for (const part of parts) {
    const segs = part.split(';');
    for (const seg of segs) {
      const [k, v] = seg.split('=').map((s) => s.trim());
      if (k?.toLowerCase() === 'for' && v) {
        const ip = stripPort(cleanToken(v));
        if (ip) return ip;
      }
    }
  }
  return null;
}

function normalizeIp(raw?: string | null): string {
  const base = (raw ?? '').trim();
  if (!base) return 'unknown';
  // Cabeçalhos como x-forwarded-for podem vir com lista: "client, proxy1, proxy2"
  const first = (base.split(',')[0] ?? '').trim();
  const cleaned = stripPort(first.replace(/^::ffff:/, '')).trim();
  return cleaned || 'unknown';
}

/**
 * Extrai IP a partir de um objeto Headers (server components / route handlers).
 * Pode opcionalmente receber o objeto Request/IncomingMessage para fallback via
 * `socket.remoteAddress` quando nenhum cabeçalho confiável estiver presente.
 * Esse fallback é aplicado apenas em ambientes não-produtivos para evitar
 * spoofing.
 */
export function getClientIpFromHeaders(
  hdrs: Headers,
  req?: Request | IncomingMessage,
): string {
  for (const name of CANDIDATE_HEADERS) {
    const value = hdrs.get(name);
    if (!value) continue;

    if (name === 'forwarded') {
      const ip = parseForwardedHeader(value);
      if (ip) {
        const n = normalizeIp(ip);
        if (n !== 'unknown') return n;
      }
      continue;
    }

    const n = normalizeIp(value);
    if (n !== 'unknown') return n;
  }

  // Fallback para o IP do socket apenas em ambientes de confiança
  if (req && process.env.NODE_ENV !== 'production') {
    const addr = (req as any)?.socket?.remoteAddress;
    const n = normalizeIp(addr);
    if (n !== 'unknown') return n;
  }

  return 'unknown';
}

/**
 * Versão que aceita NextRequest (middleware/route handlers no Edge/Node).
 */
export function getClientIp(req: NextRequest): string {
  return getClientIpFromHeaders(req.headers, req as unknown as Request);
}
