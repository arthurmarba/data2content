// Inline (base64) parts ride inside the generateContent request, which Gemini caps
// at ~20MB total. base64 inflates raw bytes by ~33%, so a 14MB video becomes ~19MB
// of payload — still under the cap with room for the prompt. Anything larger must go
// through the Files API.
//
// Kept in a dependency-free module (no @google/genai) so storage/runtime code can
// import it without pulling the SDK into their Jest/runtime graph.
export const GEMINI_INLINE_VIDEO_BYTES_LIMIT = 14 * 1024 * 1024;
