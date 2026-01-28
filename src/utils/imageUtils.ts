export function isBlockedHost(url?: string | null): boolean {
    if (!url) return false;
    try {
        const host = new URL(url).hostname.toLowerCase();
        return (
            host.endsWith('fbcdn.net') ||
            host.endsWith('xx.fbcdn.net') ||
            host.endsWith('cdninstagram.com') ||
            host.endsWith('instagram.com') ||
            host.endsWith('fbsbx.com') ||
            host.endsWith('facebook.com')
        );
    } catch {
        return false;
    }
}

export function getProxiedImageUrl(url: string | null | undefined, strict = true): string | null {
    if (!url) return null;

    let finalUrl = url;

    // Se for um host bloqueado, usamos o proxy
    if (isBlockedHost(url)) {
        // Evita duplicar o prefixo se já estiver proxied
        if (!finalUrl.startsWith('/api/proxy/thumbnail/')) {
            finalUrl = `/api/proxy/thumbnail/${encodeURIComponent(url)}`;
        }
    }

    // Se estamos usando o proxy, adiciona o parametro strict se solicitado
    // O parametro strict=1 força o proxy a falhar (422/500) se a imagem for 1x1, 
    // permitindo que o frontend detecte o erro e tente fallback ou mostre placeholder.
    if (finalUrl.startsWith('/api/proxy/thumbnail/')) {
        const separator = finalUrl.includes('?') ? '&' : '?';
        if (!finalUrl.includes('strict=')) {
            finalUrl = `${finalUrl}${separator}strict=${strict ? '1' : '0'}`;
        }
    }

    return finalUrl;
}
