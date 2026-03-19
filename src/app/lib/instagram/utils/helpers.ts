// src/app/lib/instagram/utils/helpers.ts

// Importa os tipos de mídia se você tiver uma definição mais estrita para eles,
// caso contrário, o tipo string literal usado abaixo é suficiente.
// import { InstagramMedia } from '../types'; // Descomente se 'InstagramMedia' tiver um tipo mais específico para media_type

/**
 * Mapeia o tipo de mídia da API do Instagram para o ID canônico de formato.
 *
 * @param mediaType - O tipo de mídia retornado pela API (ex: 'IMAGE', 'VIDEO', 'CAROUSEL_ALBUM').
 * @returns Um ID canônico representando o formato da mídia (ex: 'photo', 'reel', 'carousel').
 */
export function mapMediaTypeToFormat(
    mediaType?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'STORY'
  ): string {
    switch (mediaType) {
      case 'IMAGE':
        return 'photo';
      case 'VIDEO': // A API do Instagram geralmente retorna 'VIDEO' para Reels também.
        return 'reel';
      case 'CAROUSEL_ALBUM':
        return 'carousel';
      case 'STORY':
        return '';
      default:
        return '';
    }
  }
  
  // Outras funções auxiliares genéricas podem ser adicionadas aqui no futuro.
  // Por exemplo, funções para formatação de datas, números, etc.,
  // que sejam específicas para a lógica do Instagram mas não se encaixem em outros módulos.
  
  
