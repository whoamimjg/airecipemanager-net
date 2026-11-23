-- Marks a recipe photo as AI-generated (generate-recipe-image), so the apps can badge it
-- and the store listings stay honest about what is synthetic.
alter table public.recipes add column if not exists image_is_ai boolean not null default false;
