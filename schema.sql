-- MAGI PERSONAL - DATABASE SCHEMA
-- Execute this script in your Supabase project's SQL Editor (https://database.new)

-- Drop table if exists (for resetting)
-- DROP TABLE IF EXISTS memories;

-- Create memories table to store decisions, votes, and outcome reflections
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  category VARCHAR(50) NOT NULL, -- 'Finanzas', 'Relaciones', 'Salud', 'Trabajo', 'Proyecto'
  decision TEXT NOT NULL, -- The user's input question
  
  -- Emotional Memory (Upgrade 1)
  emotional_state VARCHAR(50) DEFAULT 'Calmado', -- Calmado, Ansioso, Estresado, Eufórico, Cansado
  daily_context TEXT DEFAULT NULL, -- Daily events or context
  
  -- Melchior Evaluation
  melchor_vote VARCHAR(2) NOT NULL, -- 'SI' / 'NO'
  melchor_confidence INT NOT NULL, -- 0 to 100
  melchor_reasoning TEXT NOT NULL,
  
  -- Balthasar Evaluation
  balthasar_vote VARCHAR(2) NOT NULL, -- 'SI' / 'NO'
  balthasar_confidence INT NOT NULL,
  balthasar_reasoning TEXT NOT NULL,
  
  -- Casper Evaluation
  casper_vote VARCHAR(2) NOT NULL, -- 'SI' / 'NO'
  casper_confidence INT NOT NULL,
  casper_reasoning TEXT NOT NULL,
  
  -- Consensus Summary
  consensus_vote VARCHAR(10) NOT NULL, -- 'APPROVED' / 'REJECTED'
  consensus_reasoning TEXT NOT NULL, -- Synthesized reasoning
  
  -- Obedience & Follow-up (MVP 3)
  user_action VARCHAR(2) DEFAULT NULL, -- 'SI' / 'NO' (if the user performed the action)
  reflection TEXT DEFAULT NULL -- The outcome note written by the user later
);

-- Enable Row Level Security (RLS)
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows anonymous access for read/write.
-- In a private app with local configuration, you can use the Supabase Anon Key.
-- This policy allows all operations if you're using the standard client.
CREATE POLICY "Permitir operaciones anónimas en memories" 
ON memories 
FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);
