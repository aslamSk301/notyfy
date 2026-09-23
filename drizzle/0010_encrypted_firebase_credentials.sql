-- Migration 0010: Add encrypted firebase_credentials column to projects table
-- SQLite / Cloudflare D1 supports ALTER TABLE ADD COLUMN

ALTER TABLE "projects" ADD COLUMN "firebase_credentials" TEXT;
