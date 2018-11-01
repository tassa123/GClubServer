CREATE TRIGGER `before_insert_user_info`
BEFORE INSERT ON `user_info` FOR EACH ROW
BEGIN
  IF new.id IS NULL THEN
    SET new.id = REPLACE(UUID(),'-','');
  END IF;
END;;