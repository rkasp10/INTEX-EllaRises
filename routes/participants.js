const express = require("express");
const router = express.Router();

// Temporary test route
router.get("/", (req, res) => {
  res.send("Participants route working");
});

module.exports = router;
