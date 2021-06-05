create table users (email varchar(512), hash varchar(128), salt varchar(32), activated integer default 0, PRIMARY KEY (email));
create table account_activations (email varchar(128), uid varchar(36), PRIMARY KEY (email), constraint fk_users FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE);
