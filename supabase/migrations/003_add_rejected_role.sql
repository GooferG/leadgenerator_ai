-- Extend the role check constraint to allow 'rejected' as a valid value.
-- We drop the old constraint and add a new one that includes 'rejected'.
alter table users
  drop constraint if exists users_role_check;

alter table users
  add constraint users_role_check
  check (role in ('user', 'admin', 'rejected'));
