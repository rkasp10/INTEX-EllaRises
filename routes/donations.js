const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.send("Donations route working");
});

module.exports = router;
