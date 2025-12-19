export function stripUnprovenCommunityClaims(text: string, hasEvidence: boolean): string {
    if (hasEvidence || !text) return text;
    const replacements = [
        /basead[oa]s?\s+em\s+posts[^.\n]*comunidade/gi,
        /basead[oa]s?\s+em\s+conte[úu]dos[^.\n]*comunidade/gi,
    ];
    let updated = text;
    for (const pattern of replacements) {
        updated = updated.replace(
            pattern,
            'Ideias sugeridas para você (sem exemplos validados da comunidade agora)'
        );
    }
    return updated;
}
