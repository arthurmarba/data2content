import React from 'react';
import { ImageResponse } from '@vercel/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const OG_CACHE_CONTROL = 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400';

function buildCard() {
  return React.createElement(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(140deg, #0b1220 0%, #0f172a 45%, #1f2937 100%)',
        color: '#f8fafc',
        padding: '52px',
        fontFamily: 'Arial, sans-serif',
      },
    },
    React.createElement('div', {
      style: {
        position: 'absolute',
        top: '-120px',
        right: '-90px',
        width: '390px',
        height: '390px',
        borderRadius: '9999px',
        background: 'rgba(56, 189, 248, 0.16)',
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        bottom: '-130px',
        left: '-75px',
        width: '340px',
        height: '340px',
        borderRadius: '9999px',
        background: 'rgba(16, 185, 129, 0.18)',
      },
    }),
    React.createElement(
      'div',
      {
        style: {
          position: 'relative',
          zIndex: 2,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRadius: '28px',
          border: '1px solid rgba(148, 163, 184, 0.35)',
          background: 'rgba(15, 23, 42, 0.62)',
          padding: '42px',
        },
      },
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          },
        },
        React.createElement(
          'div',
          {
            style: {
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #22d3ee 0%, #34d399 100%)',
              color: '#0b1220',
              fontSize: '26px',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            },
          },
          'D2C',
        ),
        React.createElement(
          'div',
          {
            style: {
              color: '#bae6fd',
              fontSize: '24px',
              fontWeight: 700,
              letterSpacing: '0.06em',
            },
          },
          'DATA2CONTENT',
        ),
      ),
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            maxWidth: '930px',
          },
        },
        React.createElement(
          'div',
          {
            style: {
              fontSize: '66px',
              lineHeight: 1.05,
              fontWeight: 800,
            },
          },
          'IA para criadores fecharam mais publis e organizaram a carreira.',
        ),
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
            },
          },
          React.createElement(
            'span',
            {
              style: {
                borderRadius: '9999px',
                border: '1px solid rgba(148, 163, 184, 0.5)',
                background: 'rgba(30, 41, 59, 0.85)',
                color: '#e2e8f0',
                fontSize: '26px',
                fontWeight: 600,
                padding: '8px 14px',
              },
            },
            'Análise de posts',
          ),
          React.createElement(
            'span',
            {
              style: {
                borderRadius: '9999px',
                border: '1px solid rgba(148, 163, 184, 0.5)',
                background: 'rgba(30, 41, 59, 0.85)',
                color: '#e2e8f0',
                fontSize: '26px',
                fontWeight: 600,
                padding: '8px 14px',
              },
            },
            'Mídia kit com métricas',
          ),
          React.createElement(
            'span',
            {
              style: {
                borderRadius: '9999px',
                border: '1px solid rgba(148, 163, 184, 0.5)',
                background: 'rgba(30, 41, 59, 0.85)',
                color: '#e2e8f0',
                fontSize: '26px',
                fontWeight: 600,
                padding: '8px 14px',
              },
            },
            'Propostas com marcas',
          ),
        ),
      ),
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          },
        },
        React.createElement(
          'span',
          {
            style: {
              color: '#cbd5e1',
              fontSize: '30px',
            },
          },
          'data2content.ai',
        ),
        React.createElement(
          'span',
          {
            style: {
              color: '#67e8f9',
              fontSize: '24px',
              fontWeight: 700,
            },
          },
          'Comece grátis',
        ),
      ),
    ),
  );
}

export async function GET() {
  return new ImageResponse(buildCard(), {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    headers: {
      'Cache-Control': OG_CACHE_CONTROL,
    },
  });
}
