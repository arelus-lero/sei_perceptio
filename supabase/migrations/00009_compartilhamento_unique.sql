-- Migration: 00009_compartilhamento_unique.sql
-- RF-031: um compartilhamento por usuário destino por notebook

CREATE UNIQUE INDEX IF NOT EXISTS uq_compartilhamento_notebook_usuario
    ON compartilhamento (notebook_id, usuario_destino_id);
