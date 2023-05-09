const express = require("express");

const {
  isRequestValidated,
  validateUserRequest,
  validateUserApplyCouponRequest,
} = require("../validators/user");

const { createUser, applyCoupon } = require("../controllers/user");

const router = express.Router();

router.post("/", validateUserRequest, isRequestValidated, createUser);
router.post(
  "/apply_coupon",
  validateUserApplyCouponRequest,
  isRequestValidated,
  applyCoupon
);

module.exports = router;
