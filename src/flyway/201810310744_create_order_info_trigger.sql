CREATE TRIGGER `before_insert_order_info`
BEFORE INSERT ON `order_info` FOR EACH ROW
BEGIN
  IF new.id IS NULL THEN
    SET new.id = REPLACE(UUID(),'-','');
  END IF;
END;;