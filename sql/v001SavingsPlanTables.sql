create sequence savings_plans_ids start 100;

create table savings_plans (id integer, user_id integer, trading_pair varchar(32), amount double precision, platform_name varchar(64), frequency_unit varchar(32), frequency_value integer,
    primary key(id),
    constraint fk_user foreign key (user_id) references users(id) on delete cascade,
    constraint fk_platforms foreign key (platform_name) references platforms(id) on delete cascade
);
