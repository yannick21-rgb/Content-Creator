-- Add independent IV/tag columns for the refresh token so it can be stored and
-- decrypted correctly (GCM requires a unique IV per ciphertext).
ALTER TABLE "social_account" ADD COLUMN "refresh_token_iv" text;
ALTER TABLE "social_account" ADD COLUMN "refresh_token_tag" text;
