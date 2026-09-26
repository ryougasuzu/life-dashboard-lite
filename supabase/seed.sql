-- Shared nutrient definitions.
-- Run after setup.sql.

insert into public.life_nutrient_definitions
  (code, name_ja, unit, category, sort_order)
values
  ('dietary_fiber','食物繊維','g','other',10),
  ('salt_equivalent','食塩相当量','g','other',20),
  ('potassium','カリウム','mg','mineral',110),
  ('calcium','カルシウム','mg','mineral',120),
  ('magnesium','マグネシウム','mg','mineral',130),
  ('phosphorus','リン','mg','mineral',140),
  ('iron','鉄','mg','mineral',150),
  ('zinc','亜鉛','mg','mineral',160),
  ('copper','銅','mg','mineral',170),
  ('manganese','マンガン','mg','mineral',180),
  ('vitamin_a_rae','ビタミンA','µg RAE','vitamin',210),
  ('vitamin_d','ビタミンD','µg','vitamin',220),
  ('vitamin_e_alpha','ビタミンE','mg','vitamin',230),
  ('vitamin_k','ビタミンK','µg','vitamin',240),
  ('vitamin_b1','ビタミンB1','mg','vitamin',250),
  ('vitamin_b2','ビタミンB2','mg','vitamin',260),
  ('niacin_neq','ナイアシン','mg NE','vitamin',270),
  ('vitamin_b6','ビタミンB6','mg','vitamin',280),
  ('vitamin_b12','ビタミンB12','µg','vitamin',290),
  ('folate','葉酸','µg','vitamin',300),
  ('pantothenic_acid','パントテン酸','mg','vitamin',310),
  ('vitamin_c','ビタミンC','mg','vitamin',320)
on conflict (code) do update set
  name_ja = excluded.name_ja,
  unit = excluded.unit,
  category = excluded.category,
  sort_order = excluded.sort_order;
