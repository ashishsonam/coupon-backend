const { check, validationResult } = require("express-validator");

exports.validateUserRequest = [
  check("name").notEmpty().withMessage("Name must not be empty"),
  check("email").notEmpty().withMessage("Email must not be empty"),
  check("age").notEmpty().withMessage("Age must not be empty"),
];

exports.validateUserApplyCouponRequest = [
  check("product_price")
    .notEmpty()
    .withMessage("Product Price must not be empty"),
  check("code").notEmpty().withMessage("Coupon codes must not be empty"),
  check("user_id").notEmpty().withMessage("User id must not be empty"),
];

exports.isRequestValidated = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.array().length > 0) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};
