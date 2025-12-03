const express = require("express");
const router = express.Router();

// Public donation form (no login required)
router.get("/donate", (req, res) => {
  res.render("donations/donate");
});

// Handle donation submission (no login required)
router.post("/donate", async (req, res) => {
  const { donor_name, email, amount, message } = req.body;
  
  // TODO: Save donation to database
  // For now, just redirect with a thank you
  console.log("New donation:", { donor_name, email, amount, message });
  
  res.send(`
    <html>
    <head><link rel="stylesheet" href="/css/style.css"></head>
    <body class="landing-body" style="display:flex; justify-content:center; align-items:center; min-height:100vh;">
      <div style="text-align:center; background: var(--pink-light); padding: 40px; border-radius: 20px; max-width: 500px;">
        <h1 style="color: var(--green-dark); font-family: var(--font-display);">Thank You!</h1>
        <p>Thank you, ${donor_name}, for your generous donation of $${amount}.</p>
        <p>Your support helps us empower young women through STEAM education.</p>
        <a href="/" style="display:inline-block; margin-top:20px; padding:12px 30px; background:var(--green-soft); color:white; text-decoration:none; border-radius:20px;">Return Home</a>
      </div>
    </body>
    </html>
  `);
});

// Protected route - view all donations (requires login)
router.get("/", (req, res) => {
  // TODO: Fetch donations from database and display
  res.send("Donations list - requires login to view");
});

module.exports = router;
