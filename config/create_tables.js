if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:2408@localhost:5432/seekho",
});

pool.on("connect", () => {
  console.log("Connected!");
});

const create_tables = async () => {
  try {
    // await pool.query(`DROP TABLE coupons_for_dfs;`);
    // await pool.query(`DROP TABLE coupons_for_age_groups;`);
    // await pool.query(`DROP TABLE users_coupons;`);
    // await pool.query(`DROP TABLE coupons;`);
    await pool.query(`DROP TABLE users;`);

    await pool.query(
      `CREATE TABLE users (
            name text NOT NULL,
            email text UNIQUE NOT NULL,
            user_id SERIAL,
            age INTEGER NOT NULL,
            created_at timestamptz NOT NULL,
            CONSTRAINT USR_PK PRIMARY KEY(user_id)
        );`
    );

    // await pool.query(
    //   `CREATE TYPE coupon_type AS ENUM ('ABSOLUTE', 'PERCENTAGE', 'FIXED');`
    // );

    // await pool.query(
    //   `CREATE TYPE coupon_category AS ENUM ('ALL', 'DFS', 'AGE_GROUP');`
    // );

    await pool.query(
      `CREATE TABLE coupons (
            name text NOT NULL,
            code text UNIQUE NOT NULL,
            type coupon_type NOT NULL,
            discount integer NOT NULL,
            created_at timestamptz NOT NULL,
            deleted_at timestamptz,
            start_date timestamptz,
            end_date timestamptz,
            category coupon_category NOT NULL,
            coupon_id SERIAL,
            CONSTRAINT COUP_PK PRIMARY KEY(coupon_id)
        );`
    );

    await pool.query(
      `CREATE TABLE users_coupons (
            coupon_id integer NOT NULL,
            user_id integer NOT NULL,
            times INTEGER NOT NULL,
            CONSTRAINT UC_PK PRIMARY KEY(user_id,coupon_id),
            CONSTRAINT USR_FK FOREIGN KEY (user_id) REFERENCES users(user_id),
            CONSTRAINT COUP_FK FOREIGN KEY (coupon_id) REFERENCES coupons(coupon_id)
        );`
    );

    await pool.query(
      `CREATE TABLE coupons_for_dfs (
            coupon_id integer NOT NULL,
            days integer NOT NULL,
            CONSTRAINT CFD_PK PRIMARY KEY(coupon_id,days),
            CONSTRAINT CFD_FK FOREIGN KEY (coupon_id) REFERENCES coupons(coupon_id)
        );`
    );

    await pool.query(
      `CREATE TABLE coupons_for_age_groups (
            coupon_id integer NOT NULL,
            start_age integer NOT NULL,
            end_age integer NOT NULL,
            CONSTRAINT CFAG_PK PRIMARY KEY(coupon_id,start_age,end_age),
            CONSTRAINT CFAG_FK FOREIGN KEY (coupon_id) REFERENCES coupons(coupon_id)
        );`
    );
    await pool.end();
  } catch (e) {
    console.log(e);
  }
};

create_tables();
