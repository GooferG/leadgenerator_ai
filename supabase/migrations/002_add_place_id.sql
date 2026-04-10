-- Add place_id to track which Google Place each lead came from
alter table leads add column if not exists place_id text;

-- Prevent a user from saving the same business twice
create unique index if not exists leads_user_place_unique
  on leads(user_id, place_id)
  where place_id is not null;
