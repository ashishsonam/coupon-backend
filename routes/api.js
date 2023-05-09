const express = require("express");
const router = express.Router();

router.get("/health", function (req, res) {
  return res.status(200).send({
    success: true,
    msg: "Done!",
  });
});

module.exports = router;
