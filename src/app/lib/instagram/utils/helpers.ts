// src/app/lib/instagram/utils/helpers.ts

// Importa os tipos de mídia se você tiver uma definição mais estrita para eles,
// caso contrário, o tipo string literal usado abaixo é suficiente.
// import { InstagramMedia } from '../types'; // Descomente se 'InstagramMedia' tiver um tipo mais específico para media_type

/**
 * Mapeia o tipo de mídia da API do Instagram para um formato de string legível.
 *
 * @param mediaType - O tipo de mídia retornado pela API (ex: 'IMAGE', 'VIDEO', 'CAROUSEL_ALBUM').
 * @returns Uma string representando o formato da mídia em português (ex: 'Foto', 'Reel', 'Carrossel').
 */
export function mapMediaTypeToFormat(
    mediaType?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'STORY'
  ): string {
    switch (mediaType) {
      case 'IMAGE':
        return 'Foto';
      case 'VIDEO': // A API do Instagram geralmente retorna 'VIDEO' para Reels também.
        return 'Reel'; // Ou 'Vídeo', dependendo da sua preferência de nomenclatura para posts de vídeo que não são Reels.
                       // Se precisar diferenciar Reels de outros vídeos, você pode precisar de lógica adicional
                       // baseada em outros campos da mídia ou insights específicos.
      case 'CAROUSEL_ALBUM':
        return 'Carrossel';
      case 'STORY':
        return 'Story'; // Embora stories sejam geralmente tratados por webhooks, o mapeamento pode ser útil.
      default:
        return 'Desconhecido';
    }
  }
  
  // Outras funções auxiliares genéricas podem ser adicionadas aqui no futuro.
  // Por exemplo, funções para formatação de datas, números, etc.,
  // que sejam específicas para a lógica do Instagram mas não se encaixem em outros módulos.
  
  