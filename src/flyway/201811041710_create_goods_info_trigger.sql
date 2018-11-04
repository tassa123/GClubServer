CREATE TRIGGER `before_insert_goods_info`
BEFORE INSERT ON `goods_info` FOR EACH ROW
BEGIN
  IF new.id IS NULL THEN
    SET new.id = REPLACE(UUID(),'-','');
  END IF;
END;;