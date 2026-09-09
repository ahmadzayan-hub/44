// Prints the SHA-256 hash of a token for RAILMIND_USERS. Usage: node scripts/hash-token.mjs <token>
import { sha256Hex } from '../src/audit/log.ts';

const token = process.argv[2];
if (!token) {
  console.error('Usage: node --experimental-strip-types scripts/hash-token.mjs <token>');
  process.exit(1);
}
console.log(await sha256Hex(token));
