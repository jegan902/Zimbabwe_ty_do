-- Partner API keys move from plaintext to hash + encrypted storage.
--
-- `apiKeyHash` is the only column used for authentication lookups; `apiKeyEnc`
-- keeps an AES-256-GCM copy (ENCRYPTION_KEY) so the key owner can still reveal it.
-- The legacy `apiKey` column is kept so the backfill / lazy migration can read
-- existing keys, and is emptied once they are rewritten.
ALTER TABLE "User" ADD COLUMN     "apiKeyHash" TEXT,
ADD COLUMN     "apiKeyEnc" TEXT;

CREATE UNIQUE INDEX "User_apiKeyHash_key" ON "User"("apiKeyHash");
