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

export function getProxiedImageUrl(url: string | null | undefined, strict = false): string | null {
    if (!url) return null;

    let finalUrl = url;

    // Se for um host bloqueado, usamos o proxy
    if (isBlockedHost(url)) {
        // Evita duplicar o prefixo se já estiver proxied
        if (!finalUrl.startsWith('/api/proxy/thumbnail/')) {
            finalUrl = `/api/proxy/thumbnail/${encodeURIComponent(url)}`;
        }
    }

    // Para a UI, o padrao e usar modo nao estrito para evitar 502 ruidoso em expiracao
    // de URL assinada ou falhas transientes do CDN. Fluxos server-side podem optar por strict=1.
    if (finalUrl.startsWith('/api/proxy/thumbnail/')) {
        const separator = finalUrl.includes('?') ? '&' : '?';
        if (!finalUrl.includes('strict=')) {
            finalUrl = `${finalUrl}${separator}strict=${strict ? '1' : '0'}`;
        }
    }

    return finalUrl;
}
