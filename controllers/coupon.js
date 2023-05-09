const db = require("../config/db");
const { CouponCategory } = require("../utils/enums");

exports.createCoupon = async (req, res) => {
  try {
    const { name, code, type, discount, start_date, end_date, category } =
      req.body;

    if (code.length !== 6) {
      return res.status(400).json({
        success: false,
        msg: "Code is not valid!",
      });
    }

    if (start_date && end_date && start_date > end_date) {
      return res.status(400).json({
        success: false,
        msg: "Start date is not valid!",
      });
    }
    const currDateTime = new Date();
    const created_at = currDateTime.toISOString();

    if (category === CouponCategory.AGE_GROUP) {
      const { age_groups } = req.body;

      if (age_groups && age_groups.length > 0) {
        for (const data of age_groups) {
          const { start_age, end_age } = data;
          if (parseInt(start_age) > parseInt(end_age)) {
            return res.status(400).json({
              success: false,
              msg: "Age Group is not valid!",
            });
          }
        }
      }
    }
    await db.query(`BEGIN`);

    const response = await db.query(
      `INSERT INTO coupons
             (name, code, type, discount, created_at, start_date, end_date, category)
             values ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *;`,
      [name, code, type, discount, created_at, start_date, end_date, category]
    );

    const coupon = response.rows;
    const { coupon_id } = coupon[0];

    if (category === CouponCategory.AGE_GROUP) {
      const { age_groups } = req.body;

      if (age_groups && age_groups.length > 0) {
        for (const data of age_groups) {
          const { start_age, end_age } = data;
          await db.query(
            `INSERT INTO coupons_for_age_groups
             (coupon_id, start_age, end_age)
             values ($1, $2, $3);`,
            [coupon_id, start_age, end_age]
          );
        }
      }
    } else if (category === CouponCategory.DFS) {
      const { dfs } = req.body;
      if (dfs && dfs.length > 0) {
        for (const days of dfs) {
          await db.query(
            `INSERT INTO coupons_for_dfs
               (coupon_id, days)
               values ($1, $2);`,
            [coupon_id, days]
          );
        }
      }
    }

    delete coupon[0].coupon_id;

    await db.query(`COMMIT;`);
    return res.status(200).json({
      success: true,
      msg: "Coupon created successfully!",
      coupon: coupon[0],
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

exports.getAllCoupons = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (page < 0) {
      return res.status(400).json({
        success: false,
        msg: "Page cannot be negative!",
      });
    }

    if (limit < 0) {
      return res.status(400).json({
        success: false,
        msg: "Limit cannot be negative!",
      });
    }
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const result = {};

    const rows_count = await db.query(
      `SELECT COUNT(*)
             from coupons where deleted_at is NULL;`
    );

    const totalCount = rows_count.rows[0].count;
    const totalPage = Math.ceil(totalCount / limit);

    if (endIndex < totalCount) {
      result.next = {
        page: page + 1,
        limit: limit,
      };
    }

    if (startIndex > 0) {
      result.previous = {
        page: page - 1,
        limit: limit,
      };
    }

    result.total = totalCount;
    result.currentPage = page;
    result.currentLimit = limit;
    result.totalPages = totalPage;

    const { rows } = await db.query(
      `SELECT name, code, type, discount, created_at,start_date, end_date, category
             from coupons where deleted_at is NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2;`,
      [limit, startIndex]
    );

    result.couponsList = rows;
    return res.status(200).json({
      success: true,
      msg: "Coupons Fetch Successfully!",
      result: result,
    });
  } catch (e) {
    return res.status(400).json({
      error: e.message,
      success: false,
      msg: "Something Went Wrong!",
    });
  }
};

exports.getCoupon = async (req, res) => {
  try {
    const code = req.params.code;

    const { rows } = await db.query(`SELECT * from coupons where code = $1;`, [
      code,
    ]);

    const couponDetail = rows[0];
    const { coupon_id } = couponDetail;
    if (rows.length === 0 || couponDetail.deleted_at) {
      return res.status(400).json({
        success: false,
        msg: "Coupon doesn't exist!",
      });
    }

    if (couponDetail.category == CouponCategory.AGE_GROUP) {
      const { rows } = await db.query(
        `SELECT start_age, end_age
             from coupons_for_age_groups where coupon_id = $1;`,
        [coupon_id]
      );
      couponDetail.age_groups = rows;
    } else if (couponDetail.category == CouponCategory.DFS) {
      const { rows } = await db.query(
        `SELECT days
             from coupons_for_dfs where coupon_id = $1;`,
        [coupon_id]
      );
      couponDetail.dfs = [];
      for (const data of rows) {
        couponDetail.dfs.push(data.days);
      }
    }

    delete rows[0].coupon_id;

    return res.status(200).json({
      success: true,
      msg: "Coupon Fetch Successfully!",
      coupon: rows[0],
    });
  } catch (e) {
    return res.status(400).json({
      error: e.message,
      success: false,
      msg: "Something Went Wrong!",
    });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const code = req.params.code;

    const { rows } = await db.query(
      `SELECT coupon_id, deleted_at from coupons where code = $1;`,
      [code]
    );

    const couponDetail = rows[0];
    const { coupon_id } = couponDetail;

    if (rows.length === 0 || couponDetail.deleted_at !== null) {
      return res.status(400).json({
        success: false,
        msg: "Coupon doesn't exist!",
      });
    }

    const currDateTime = new Date();
    const deleted_at = currDateTime.toISOString();

    await db.query(`BEGIN`);

    await db.query(
      `UPDATE coupons SET
             deleted_at = $1
             where coupon_id = $2
             RETURNING *;`,
      [deleted_at, coupon_id]
    );

    await db.query(`COMMIT;`);
    return res.status(200).json({
      success: true,
      msg: "Coupon Delete Successfully!",
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

exports.updateCoupon = async (req, res) => {
  try {
    const { code } = req.body;

    const { rows } = await db.query(`SELECT * from coupons where code = $1;`, [
      code,
    ]);

    const currCoupon = rows[0];

    const { coupon_id } = currCoupon;
    if (rows.length === 0 || currCoupon.deleted_at !== null) {
      return res.status(400).json({
        success: false,
        msg: "Coupon doesn't exist!",
      });
    }

    const { name, type, discount, start_date, end_date, category } = req.body;

    const updateFields = {
      name,
      type,
      discount,
      start_date,
      end_date,
      category,
    };

    if (start_date && end_date && start_date > end_date) {
      return res.status(400).json({
        success: false,
        msg: "Start date is not valid!",
      });
    }

    if (
      !start_date &&
      end_date &&
      currCoupon.start_date &&
      currCoupon.start_date > end_date
    ) {
      return res.status(400).json({
        success: false,
        msg: "End date is not valid!",
      });
    }

    if (category && category === CouponCategory.AGE_GROUP) {
      const { age_groups } = req.body;

      if (age_groups && age_groups.length > 0) {
        for (const data of age_groups) {
          const { start_age, end_age } = data;
          if (parseInt(start_age) > parseInt(end_age)) {
            return res.status(400).json({
              success: false,
              msg: "Age Group is not valid!",
            });
          }
        }
      }
    }

    await db.query(`BEGIN`);

    for (const field of Object.keys(updateFields)) {
      if (
        updateFields[field] ||
        (!updateFields[field] && field === ("start_date" || "end_date"))
      ) {
        await db.query(
          `UPDATE coupons SET
             ${field} = $1
             where coupon_id = $2;`,
          [updateFields[field], coupon_id]
        );
      }
    }

    if (category && currCoupon.category !== category) {
      if (currCoupon.category === CouponCategory.AGE_GROUP) {
        await db.query(
          `DELETE from coupons_for_age_groups where coupon_id = $1;`,
          [coupon_id]
        );
      } else if (currCoupon.category === CouponCategory.DFS) {
        await db.query(`DELETE from coupons_for_dfs where coupon_id = $1;`, [
          coupon_id,
        ]);
      }
      if (category === CouponCategory.AGE_GROUP) {
        const { age_groups } = req.body;

        if (age_groups && age_groups.length > 0) {
          for (const data of age_groups) {
            const { start_age, end_age } = data;
            await db.query(
              `INSERT INTO coupons_for_age_groups
             (coupon_id, start_age, end_age)
             values ($1, $2, $3);`,
              [coupon_id, start_age, end_age]
            );
          }
        }
      } else if (category === CouponCategory.DFS) {
        const { dfs } = req.body;
        if (dfs && dfs.length > 0) {
          for (const days of dfs) {
            await db.query(
              `INSERT INTO coupons_for_dfs
               (coupon_id, days)
               values ($1, $2);`,
              [coupon_id, days]
            );
          }
        }
      }
    } else {
      if (currCoupon.category === CouponCategory.AGE_GROUP) {
        const { age_groups } = req.body;

        const { rows } = await db.query(
          `SELECT start_age, end_age
                from coupons_for_age_groups where coupon_id = $1;`,
          [coupon_id]
        );

        currCoupon.age_groups = rows;

        const currAgeGrpsSet = new Set();
        for (const data of currCoupon.age_groups) {
          if (!currAgeGrpsSet.has(JSON.stringify(data))) {
            currAgeGrpsSet.add(JSON.stringify(data));
          }
        }

        //check for new values
        const newAgeGrpsSet = new Set();

        for (const data of age_groups) {
          if (!currAgeGrpsSet.has(JSON.stringify(data))) {
            const { start_age, end_age } = data;
            await db.query(
              `INSERT INTO coupons_for_age_groups
             (coupon_id, start_age, end_age)
             values ($1, $2, $3);`,
              [coupon_id, start_age, end_age]
            );
          }
          newAgeGrpsSet.add(JSON.stringify(data));
        }

        //check for deleted values
        for (const data of currAgeGrpsSet) {
          if (!newAgeGrpsSet.has(data)) {
            const { start_age, end_age } = JSON.parse(data);
            await db.query(
              `DELETE from coupons_for_age_groups where coupon_id = $1 and start_age = $2 and end_age = $3;`,
              [coupon_id, start_age, end_age]
            );
          }
        }
      } else if (currCoupon.category === CouponCategory.DFS) {
        const { dfs } = req.body;

        const { rows } = await db.query(
          `SELECT days
             from coupons_for_dfs where coupon_id = $1;`,
          [coupon_id]
        );
        currCoupon.dfs = [];
        for (const data of rows) {
          currCoupon.dfs.push(data.days);
        }

        const currDfsSet = new Set();
        for (const days of currCoupon.dfs) {
          if (!currDfsSet.has(days)) {
            currDfsSet.add(days);
          }
        }

        //check for new values
        const newDfsSet = new Set();

        for (const days of dfs) {
          if (!currDfsSet.has(days)) {
            await db.query(
              `INSERT INTO coupons_for_dfs
             (coupon_id, days)
             values ($1, $2);`,
              [coupon_id, days]
            );
          }
          newDfsSet.add(days);
        }

        //check for deleted values
        for (const days of currDfsSet) {
          if (!newDfsSet.has(days)) {
            await db.query(
              `DELETE from coupons_for_dfs where coupon_id = $1 and days = $2;`,
              [coupon_id, days]
            );
          }
        }
      }
    }

    await db.query(`COMMIT;`);

    return res.status(200).json({
      success: true,
      msg: "Coupon Update Successfully!",
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
