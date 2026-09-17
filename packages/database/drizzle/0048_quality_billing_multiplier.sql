ALTER TABLE "image_backend_api" ADD COLUMN IF NOT EXISTS "quality_billing" json;
ALTER TABLE "image_backend_account" ADD COLUMN IF NOT EXISTS "quality_billing" json;
