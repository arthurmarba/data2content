'use client';

import Image from 'next/image';
import React from 'react';

interface UserAvatarProps {
  name: string;
  src?: string | null; // Permite src nulo ou indefinido
  size?: number;
  className?: string;
}

/**
 * Componente para exibir o avatar de um usuário.
 * Renderiza uma imagem se a URL (src) for fornecida. Caso contrário,
 * exibe um fallback com a primeira letra do nome.
 * @param {string} name - O nome do usuário, usado para a inicial e o atributo alt.
 * @param {string | null} src - A URL da imagem do avatar.
 * @param {number} size - A largura e altura do avatar em pixels. Padrão: 40.
 * @param {string} className - Classes CSS adicionais para customização.
 */
export function UserAvatar({
  name,
  src,
  size = 40,
  className = '',
}: UserAvatarProps) {
  // Garante que o nome seja uma string para evitar erros e pega a inicial
  const initial = (name || '').charAt(0).toUpperCase();

  return src ? (
    <Image
      src={src}
      alt={`Avatar de ${name}`}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      // Adiciona um fallback em caso de erro no carregamento da imagem
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none';
        // Opcional: poderia mostrar um div de fallback aqui, mas por simplicidade, apenas esconde.
      }}
    />
  ) : (
    <div
      className={`
        flex items-center justify-center
        bg-gray-200 dark:bg-gray-700
        rounded-full
        text-gray-600 dark:text-gray-300
        font-semibold
        select-none
        ${className}
      `}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {initial}
    </div>
  );
}
