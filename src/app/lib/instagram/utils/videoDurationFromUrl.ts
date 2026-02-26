import axios from 'axios';

const RANGE_SAMPLE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_DOWNLOAD_BYTES = RANGE_SAMPLE_BYTES + 64 * 1024;
const DEFAULT_TIMEOUT_MS = 8000;

function readUint32(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return (
    (bytes[offset]! << 24) |
    (bytes[offset + 1]! << 16) |
    (bytes[offset + 2]! << 8) |
    bytes[offset + 3]!
  ) >>> 0;
}

function readUint64(bytes: Uint8Array, offset: number): bigint | null {
  if (offset < 0 || offset + 8 > bytes.length) return null;
  return (
    (BigInt(bytes[offset]!) << 56n) |
    (BigInt(bytes[offset + 1]!) << 48n) |
    (BigInt(bytes[offset + 2]!) << 40n) |
    (BigInt(bytes[offset + 3]!) << 32n) |
    (BigInt(bytes[offset + 4]!) << 24n) |
    (BigInt(bytes[offset + 5]!) << 16n) |
    (BigInt(bytes[offset + 6]!) << 8n) |
    BigInt(bytes[offset + 7]!)
  );
}

function findDurationInMvhd(bytes: Uint8Array): number | null {
  for (let i = 4; i < bytes.length - 4; i += 1) {
    // "mvhd"
    if (bytes[i] !== 0x6d || bytes[i + 1] !== 0x76 || bytes[i + 2] !== 0x68 || bytes[i + 3] !== 0x64) {
      continue;
    }

    const boxStart = i - 4;
    const boxSize = readUint32(bytes, boxStart);
    if (!boxSize) continue;

    let headerSize = 8;
    if (boxSize === 1) {
      // extended size box
      const extended = readUint64(bytes, boxStart + 8);
      if (!extended || extended <= 0n) continue;
      headerSize = 16;
    }

    const versionOffset = boxStart + headerSize;
    if (versionOffset >= bytes.length) continue;
    const version = bytes[versionOffset];

    if (version === 0) {
      const timescale = readUint32(bytes, versionOffset + 12);
      const duration = readUint32(bytes, versionOffset + 16);
      if (!timescale || !duration || timescale <= 0 || duration <= 0) continue;
      const seconds = duration / timescale;
      if (Number.isFinite(seconds) && seconds > 0) return seconds;
      continue;
    }

    if (version === 1) {
      const timescale = readUint32(bytes, versionOffset + 20);
      const duration = readUint64(bytes, versionOffset + 24);
      if (!timescale || !duration || timescale <= 0 || duration <= 0n) continue;
      const seconds = Number(duration) / timescale;
      if (Number.isFinite(seconds) && seconds > 0) return seconds;
    }
  }

  return null;
}

async function fetchSampleBytes(
  videoUrl: string,
  rangeHeader: string,
  timeoutMs: number
): Promise<Uint8Array | null> {
  try {
    const response = await axios.get<ArrayBuffer>(videoUrl, {
      responseType: 'arraybuffer',
      timeout: timeoutMs,
      headers: { Range: rangeHeader },
      maxBodyLength: MAX_DOWNLOAD_BYTES,
      maxContentLength: MAX_DOWNLOAD_BYTES,
      validateStatus: (status) => status === 200 || status === 206,
    });

    const buffer = response.data ? new Uint8Array(response.data) : null;
    if (!buffer || buffer.length === 0) return null;
    return buffer;
  } catch {
    return null;
  }
}

export async function probeVideoDurationSecondsFromUrl(
  videoUrl: string | null | undefined,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<number | null> {
  if (!videoUrl || !/^https?:\/\//i.test(videoUrl)) return null;

  const startSample = await fetchSampleBytes(videoUrl, `bytes=0-${RANGE_SAMPLE_BYTES - 1}`, timeoutMs);
  const durationFromStart = startSample ? findDurationInMvhd(startSample) : null;
  if (durationFromStart && durationFromStart > 0) return durationFromStart;

  const endSample = await fetchSampleBytes(videoUrl, `bytes=-${RANGE_SAMPLE_BYTES}`, timeoutMs);
  const durationFromEnd = endSample ? findDurationInMvhd(endSample) : null;
  if (durationFromEnd && durationFromEnd > 0) return durationFromEnd;

  return null;
}
