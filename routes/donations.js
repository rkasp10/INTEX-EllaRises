const express = require("express");
const router = express.Router();
const knex = require("knex");

// Database connection
const db = knex({
  client: "pg",
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  },
});

function isManager(req) {
  return req.session.user && req.session.user.level === "M";
}

// ============================================
// PUBLIC DONATION FORM (no login required)
// ============================================
router.get("/donate", (req, res) => {
  res.render("donations/donate");
});

router.post("/donate", async (req, res) => {
  try {
    const { participant_id, donation_amount } = req.body;

    await db("donations").insert({
      participant_id: participant_id ? parseInt(participant_id) : null,
      donation_amount: parseFloat(donation_amount),
      donation_date: new Date()
    });

    res.send(`
      <html>
      <head><link rel="stylesheet" href="/css/style.css"></head>
      <body class="landing-body" style="display:flex; justify-content:center; align-items:center; min-height:100vh;">
        <div style="text-align:center; background: var(--pink-light); padding: 40px; border-radius: 20px; max-width: 500px;">
          <h1 style="color: var(--green-dark); font-family: var(--font-display);">Thank You!</h1>
          <p>Thank you for your generous donation of $${donation_amount}.</p>
          <p>Your support helps us empower young women through STEAM education.</p>
          <a href="/" style="display:inline-block; margin-top:20px; padding:12px 30px; background:var(--green-soft); color:white; text-decoration:none; border-radius:20px;">Return Home</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("Error processing donation:", err);
    res.send("Error processing donation: " + err.message);
  }
});

// ============================================
// DONATIONS LIST (Manager only)
// ============================================
router.get("/", async (req, res) => {
  if (!isManager(req)) {
    return res.status(403).send("Access denied. Managers only.");
  }

  try {
    const donations = await db("donations")
      .select(
        "donations.*",
        "participants.participant_first_name",
        "participants.participant_last_name",
        "participants.participant_email"
      )
      .leftJoin("participants", "donations.participant_id", "participants.participant_id")
      .orderBy("donations.donation_date", "desc");

    const totalDonations = donations.reduce((sum, d) => sum + parseFloat(d.donation_amount || 0), 0);

    res.render("donations/index", {
      donations,
      totalDonations,
      isManager: true
    });
  } catch (err) {
    console.error("Error loading donations:", err);
    res.send("Error loading donations: " + err.message);
  }
});

// ============================================
// ADD DONATION (Manager)
// ============================================
router.get("/add", async (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");

  try {
    const participants = await db("participants")
      .select("participant_id", "participant_first_name", "participant_last_name")
      .orderBy("participant_last_name");

    res.render("donations/add", { participants });
  } catch (err) {
    console.error(err);
    res.render("donations/add", { participants: [] });
  }
});

router.post("/add", async (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");

  try {
    const { participant_id, donation_amount, donation_date } = req.body;

    await db("donations").insert({
      participant_id: participant_id ? parseInt(participant_id) : null,
      donation_amount: parseFloat(donation_amount),
      donation_date: donation_date || new Date()
    });

    res.redirect("/donations");
  } catch (err) {
    console.error("Error adding donation:", err);
    res.send("Error adding donation: " + err.message);
  }
});

// ============================================
// EDIT DONATION (Manager)
// ============================================
router.get("/edit/:id", async (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");

  try {
    const donation = await db("donations")
      .where({ donation_id: req.params.id })
      .first();

    const participants = await db("participants")
      .select("participant_id", "participant_first_name", "participant_last_name")
      .orderBy("participant_last_name");

    if (!donation) return res.status(404).send("Donation not found");
    res.render("donations/edit", { donation, participants });
  } catch (err) {
    console.error(err);
    res.send("Error loading donation");
  }
});

router.post("/edit/:id", async (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");

  try {
    const { participant_id, donation_amount, donation_date } = req.body;

    await db("donations")
      .where({ donation_id: req.params.id })
      .update({
        participant_id: participant_id ? parseInt(participant_id) : null,
        donation_amount: parseFloat(donation_amount),
        donation_date
      });

    res.redirect("/donations");
  } catch (err) {
    console.error("Error updating donation:", err);
    res.send("Error updating donation: " + err.message);
  }
});

// ============================================
// DELETE DONATION (Manager)
// ============================================
router.post("/delete/:id", async (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");

  try {
    await db("donations").where({ donation_id: req.params.id }).del();
    res.redirect("/donations");
  } catch (err) {
    console.error("Error deleting donation:", err);
    res.send("Error deleting donation: " + err.message);
  }
});

module.exports = router;
