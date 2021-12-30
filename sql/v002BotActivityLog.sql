create table bot_log (
    uuid varchar(128),
    user_id integer not null,
    bot_type varchar(64) not null,
    additional_info JSONB,
    active integer not null,
    created_at TIMESTAMPTZ not null default NOW(),
    primary key (uuid),
    constraint fk_user foreign key (user_id) references users(id) on delete cascade
);

create table bot_transaction_log (uuid varchar(128),
    transaction_type varchar(64) not null,
    transaction_timestamp TIMESTAMPTZ not null default NOW(),
    transaction_amount double precision not null,
    transaction_pair varchar(64) not null,
    additional_info JSONB,
    constraint fk_uuid foreign key (uuid) references bot_log(uuid) on delete cascade
);

