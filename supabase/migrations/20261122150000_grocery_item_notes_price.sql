-- Item details editable from the apps' item sheet: notes and a hand-entered price.
-- Named-list rows carry them directly; main-list items (meal-plan or manual) keep them in
-- the per-key override row the apps already use for amount/size/category.
alter table public.grocery_list_items
  add column if not exists notes text,
  add column if not exists price numeric;

alter table public.grocery_overrides
  add column if not exists notes text,
  add column if not exists price numeric;
