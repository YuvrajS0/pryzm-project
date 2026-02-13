-- This migration script will sync bookmarks with actual feed_items IDs
-- Run this in your Supabase SQL editor

-- Step 1: Add a temporary column to store the actual item ID
ALTER TABLE user_bookmarks ADD COLUMN feed_item_id TEXT;

-- Step 2: Find matching feed items by URL and store their IDs
UPDATE user_bookmarks
SET feed_item_id = feed_items.id
FROM feed_items
WHERE user_bookmarks.item_id = feed_items.url;

-- Step 3: Delete bookmarks that don't have matching feed items
DELETE FROM user_bookmarks WHERE feed_item_id IS NULL;

-- Step 4: Drop the old item_id column and rename the new one
ALTER TABLE user_bookmarks DROP COLUMN item_id;
ALTER TABLE user_bookmarks RENAME COLUMN feed_item_id TO item_id;

-- Verify the migration worked
SELECT COUNT(*) as total_bookmarks FROM user_bookmarks;
SELECT * FROM user_bookmarks LIMIT 10;
