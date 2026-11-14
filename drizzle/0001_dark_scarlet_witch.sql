CREATE TABLE `feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` text NOT NULL,
	`submission_id` text NOT NULL,
	`category` text NOT NULL,
	`message` text NOT NULL,
	`language` text NOT NULL,
	`scenario_id` text,
	`page` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_submission` ON `feedback` (`account_id`,`submission_id`);--> statement-breakpoint
CREATE INDEX `feedback_account_date` ON `feedback` (`account_id`,`created_at`);