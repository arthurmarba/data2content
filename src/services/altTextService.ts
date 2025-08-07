export function altTextService(title: string, description?: string): string {
  return description ? `${title}: ${description}` : title;
}
