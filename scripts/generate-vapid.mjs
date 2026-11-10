// Lager nye VAPID-nøkler for push-varsler og en webhook-hemmelighet.
// Bruk: npm run vapid
import { createECDH, randomBytes } from "node:crypto";

const ecdh = createECDH("prime256v1");
ecdh.generateKeys();
const priv = ecdh.getPrivateKey().toString("hex").padStart(64, "0");

console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${ecdh.getPublicKey().toString("base64url")}`);
console.log(`VAPID_PRIVATE_KEY=${Buffer.from(priv, "hex").toString("base64url")}`);
console.log(`PUSH_WEBHOOK_SECRET=${randomBytes(24).toString("base64url")}`);
console.log("\nLegg den første i .env.local (og hos hostingen), de to siste i Supabase → Edge Functions → Secrets.");
