do $$
begin
	create table if not exists "session" (
		"sid" varchar NOT NULL COLLATE "default",
		"sess" json NOT NULL,
		"expire" timestamp(6) NOT NULL,
		constraint "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
	) with (oids = false);

	create table if not exists "links" (
		slack_user_id varchar(1024) not null, 
		slack_team_id varchar(1024) not null, 
		common_auth_tokens text not null, 
		updated timestamp with time zone not null default now(),
		created timestamp with time zone not null default now(),
		constraint "links_pkey" PRIMARY KEY (slack_user_id, slack_team_id)
	);
end
$$;