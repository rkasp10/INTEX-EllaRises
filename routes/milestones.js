const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.send("Milestones route working");
});

module.exports = router;
