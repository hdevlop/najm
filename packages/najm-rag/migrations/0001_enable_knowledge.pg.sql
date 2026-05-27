ALTER TABLE chatbot_routing_settings
  ADD COLUMN IF NOT EXISTS enable_knowledge boolean NOT NULL DEFAULT true;
