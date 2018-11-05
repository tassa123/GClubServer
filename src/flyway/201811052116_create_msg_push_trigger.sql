CREATE TRIGGER `before_insert_msg_push`
BEFORE INSERT ON `msg_push` FOR EACH ROW
BEGIN
  IF new.id IS NULL THEN
    SET new.id = REPLACE(UUID(),'-','');
  END IF;
END;;