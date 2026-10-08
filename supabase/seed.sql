-- Local/demo catalog. Production migrations never depend on this seed.
insert into public.restaurants(id,name,address,phone,email,status,approved_at) values('00000000-0000-4000-8000-000000000001','RestroSync Kitchen','Demo address','9999999999','owner@example.com','ACTIVE',now()) on conflict(id)do nothing;
insert into public.restaurant_settings(restaurant_id,restaurant_name,address,phone) values('00000000-0000-4000-8000-000000000001','RestroSync Kitchen','Demo address','9999999999') on conflict(restaurant_id)do nothing;
insert into public.categories(restaurant_id,name,sort_order) values('00000000-0000-4000-8000-000000000001','Starters',1),('00000000-0000-4000-8000-000000000001','Main Course',2),('00000000-0000-4000-8000-000000000001','Beverages',3),('00000000-0000-4000-8000-000000000001','Desserts',4) on conflict(restaurant_id,name)do nothing;
with c as(select id,name from categories where restaurant_id='00000000-0000-4000-8000-000000000001')insert into menu_items(restaurant_id,category_id,name,description,price_paise,food_type)values
('00000000-0000-4000-8000-000000000001',(select id from c where name='Starters'),'Paneer Tikka','Charred cottage cheese with peppers',28900,'VEG'),
('00000000-0000-4000-8000-000000000001',(select id from c where name='Starters'),'Chicken 65','Crispy spiced chicken',32900,'NON_VEG'),
('00000000-0000-4000-8000-000000000001',(select id from c where name='Main Course'),'Butter Chicken','Chicken in tomato butter gravy',42900,'NON_VEG'),
('00000000-0000-4000-8000-000000000001',(select id from c where name='Main Course'),'Dal Makhani','Slow-cooked black lentils',29900,'VEG'),
('00000000-0000-4000-8000-000000000001',(select id from c where name='Beverages'),'Fresh Lime Soda','Sweet, salted or mixed',12900,'VEG'),
('00000000-0000-4000-8000-000000000001',(select id from c where name='Desserts'),'Gulab Jamun','Warm milk-solid dumplings',14900,'VEG') on conflict(category_id,name)do nothing;
insert into addons(restaurant_id,name,price_paise)values('00000000-0000-4000-8000-000000000001','Extra Cheese',5000),('00000000-0000-4000-8000-000000000001','Extra Butter',3000)on conflict(restaurant_id,name)do nothing;
insert into restaurant_tables(restaurant_id,name,capacity)values('00000000-0000-4000-8000-000000000001','T-01',2),('00000000-0000-4000-8000-000000000001','T-02',4),('00000000-0000-4000-8000-000000000001','T-03',6)on conflict(restaurant_id,name)do nothing;
