'use client';
export default function CookiePreferencesButton() {
  return <button type="button" className="my-3 rounded border px-4 py-2 text-sm" onClick={() => window.dispatchEvent(new Event('d2c-open-cookie-preferences'))}>Alterar preferências de cookies</button>;
}
