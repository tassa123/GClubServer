CREATE TRIGGER `before_insert_activity_info`
BEFORE INSERT ON `activity_info` FOR EACH ROW
BEGIN
  IF new.id IS NULL THEN
    SET new.id = REPLACE(UUID(),'-','');
  END IF;
END;;