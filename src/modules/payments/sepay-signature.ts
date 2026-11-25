import { createHmac, timingSafeEqual } from 'crypto';

export function verifySePaySignature(
  secret: string,
  timestampHeader: string,
  signature: string,
  rawBody: Buffer,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  if (secret.length < 32 || !/^\d{10}$/.test(timestampHeader)) return false;
  if (!/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const timestamp = Number(timestampHeader);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300) return false;

  const expected = `sha256=${createHmac('sha256', secret)
    .update(`${timestampHeader}.`)
    .update(rawBody)
    .digest('hex')}`;
  const expectedBytes = Buffer.from(expected, 'utf8');
  const suppliedBytes = Buffer.from(signature, 'utf8');
  return expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes);
}
