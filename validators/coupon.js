const { check, validationResult } = require("express-validator");

exports.validateCouponRequest = [
  check("name").notEmpty().withMessage("Name must not be empty"),
  check("code").notEmpty().withMessage("Code must not be empty"),
  check("code")
    .isLength({ min: 6, max: 6 })
    .withMessage("Code must be of 6 length"),
  check("type").notEmpty().withMessage("Type must not be empty"),
  check("discount").notEmpty().withMessage("Discount must not be empty"),
  check("category").notEmpty().withMessage("Category must not be empty"),
];

exports.validateCouponUpdateRequest = [
  check("code").notEmpty().withMessage("Coupon code must not be empty"),
];

exports.isRequestValidated = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.array().length > 0) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};
