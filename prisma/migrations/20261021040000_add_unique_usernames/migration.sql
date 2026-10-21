-- Usernames identify login accounts and must be unique.

ALTER TABLE `users`
  MODIFY `username` VARCHAR(150) NOT NULL;

CREATE UNIQUE INDEX `users_username_key` ON `users`(`username`);
