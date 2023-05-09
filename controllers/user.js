const db = require("../config/db");
const { CouponCategory, CouponTypes } = require("../utils/enums");

exports.createUser = async (req, res) => {
  try {
    const { name, email, age } = req.body;

    const currDateTime = new Date();
    const created_at = currDateTime.toISOString();
    await db.query(`BEGIN`);

    const response = await db.query(
      `INSERT INTO users
             (name, email, age,created_at)
             values ($1, $2, $3, $4)
             RETURNING *;`,
      [name, email, age, created_at]
    );

    const user = response.rows;

    await db.query(`COMMIT;`);
    return res.status(200).json({
      success: true,
      msg: "User created successfully!",
      user: user[0],
    });
  } catch (e) {
    await db.query(`ROLLBACK;`);
    return res.status(400).json({
      error: e.message,
      success: false,
      msg: "Something Went Wrong!",
    });
  }
};

exports.applyCoupon = async (req, res) => {
  try {
    const { product_price, code, user_id } = req.body;

    const users = await db.query(`SELECT * from users where user_id = $1;`, [
      user_id,
    ]);

    if (users.rows.length === 0) {
      return res.status(400).json({
        success: false,
        msg: "User doesn't exist!",
      });
    }

    const user = users.rows[0];

    const coupons = await db.query(`SELECT * from coupons where code = $1;`, [
      code,
    ]);

    const couponDetail = coupons.rows[0];

    if (coupons.rows.length === 0 || couponDetail.deleted_at !== null) {
      return res.status(400).json({
        success: false,
        msg: "Coupon doesn't exist!",
      });
    }

    const currDateTime = new Date();
    const couponStartDate = couponDetail.start_date;
    const couponEndDate =
      couponDetail.end_date !== null ? couponDetail.end_date : undefined;

    if (
      (couponStartDate && couponStartDate > currDateTime) ||
      (couponEndDate && couponEndDate < currDateTime)
    ) {
      return res.status(400).json({
        success: false,
        msg: "Coupon is expired or not yet in use!",
      });
    }

    const { coupon_id, discount } = couponDetail;

    const coupons_used = await db.query(
      `SELECT * from users_coupons where user_id = $1 and coupon_id = $2;`,
      [user_id, coupon_id]
    );

    await db.query(`BEGIN`);

    if (couponDetail.category === CouponCategory.DFS) {
      const userSignupDate = user.created_at;
      const difference_In_Time =
        currDateTime.getTime() - userSignupDate.getTime();
      const number_of_days = difference_In_Time / (1000 * 3600 * 24);

      const { rows } = await db.query(
        `SELECT days
             from coupons_for_dfs where coupon_id = $1;`,
        [coupon_id]
      );
      const dfs = [];
      for (const data of rows) {
        dfs.push(data.days);
      }
      dfs.sort();

      if (coupons_used.rows.length === dfs.length) {
        return res.status(400).json({
          success: false,
          msg: "Coupon is already claimed!",
        });
      }

      let applied = false;
      let times =
        coupons_used.rows.length === 0 ? 0 : coupons_used.rows[0].times;

      for (const days of dfs.slice(times)) {
        if (number_of_days >= days) {
          if (coupons_used.rows.length === 0) {
            await db.query(
              `INSERT INTO users_coupons
             (coupon_id, user_id, times)
             values ($1, $2, 1)
             RETURNING *;`,
              [coupon_id, user_id]
            );
          } else {
            times = times + 1;
            await db.query(
              `UPDATE users_coupons
                    SET times = $1
                    where coupon_id = $2;`,
              [times, coupon_id]
            );
          }
          applied = true;
          break;
        } else {
          break;
        }
      }
      if (!applied) {
        return res.status(400).json({
          success: false,
          msg: "Coupon is not valid!",
        });
      }
    } else if (couponDetail.category === CouponCategory.AGE_GROUP) {
      const { rows } = await db.query(
        `SELECT start_age, end_age
             from coupons_for_age_groups where coupon_id = $1;`,
        [coupon_id]
      );

      const age_groups = rows;
      let applied = false;
      for (const data of age_groups) {
        const { start_age, end_age } = data;

        if (user.age >= start_age && user.age <= end_age) {
          if (coupons_used.rows.length !== 0) {
            let times = coupons_used.rows[0].times;
            times = times + 1;
            await db.query(
              `UPDATE users_coupons
                    SET times = $1
                    where coupon_id = $2;`,
              [times, coupon_id]
            );
          } else {
            await db.query(
              `INSERT INTO users_coupons
             (coupon_id, user_id, times)
             values ($1, $2, 1)
             RETURNING *;`,
              [coupon_id, user_id]
            );
          }
          applied = true;
          break;
        }
      }
      if (!applied) {
        return res.status(400).json({
          success: false,
          msg: "Coupon is not valid!",
        });
      }
    } else {
      if (coupons_used.rows.length !== 0) {
        let times = coupons_used.rows[0].times;
        times = times + 1;
        await db.query(
          `UPDATE users_coupons
                    SET times = $1
                    where coupon_id = $2;`,
          [times, coupon_id]
        );
      } else {
        await db.query(
          `INSERT INTO users_coupons
             (coupon_id, user_id, times)
             values ($1, $2, 1)
             RETURNING *;`,
          [coupon_id, user_id]
        );
      }
    }

    let discountPrice;

    if (couponDetail.type === CouponTypes.ABSOLUTE) {
      if (discount < product_price) {
        discountPrice = product_price - discount;
      } else {
        return res.status(400).json({
          success: false,
          msg: "Coupon cannot be applied!",
        });
      }
    } else if (couponDetail.type === CouponTypes.FIXED) {
      if (discount < product_price) {
        discountPrice = discount;
      } else {
        return res.status(400).json({
          success: false,
          msg: "Coupon cannot be applied!",
        });
      }
    } else {
      const perDiscount = product_price - product_price * (discount / 100);
      if (perDiscount < product_price) {
        discountPrice = perDiscount;
      } else {
        return res.status(400).json({
          success: false,
          msg: "Coupon cannot be applied!",
        });
      }
    }
    await db.query(`COMMIT;`);
    return res.status(200).json({
      success: true,
      msg: "Coupon applied successfully!",
      discountPrice,
    });
  } catch (e) {
    await db.query(`ROLLBACK;`);
    return res.status(400).json({
      error: e.message,
      success: false,
      msg: "Something Went Wrong!",
    });
  }
};
