CREATE TRIGGER `before_insert_score_log`
BEFORE INSERT ON `score_log` FOR EACH ROW
BEGIN
  IF new.id IS NULL THEN
    SET new.id = REPLACE(UUID(),'-','');
  END IF;
END;;