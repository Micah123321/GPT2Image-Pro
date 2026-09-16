ALTER TABLE "image_backend_api" ADD COLUMN IF NOT EXISTS "model_mapping" json;
ALTER TABLE "user_api_config" ADD COLUMN IF NOT EXISTS "model_mapping" json;
