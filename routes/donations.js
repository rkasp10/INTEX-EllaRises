// This file houses all of the routes for the donations views.


const express = require("express");
const router = express.Router();
const db = require("../db"); // Shared database connection

function isManager(req) {
  return req.session.user && req.session.user.level === "M";
}

// ============================================
// DONATIONS LIST
// - Managers: Full view with all details + CRUD
// - Participants: Simplified view (names & dates only) with pagination
// ============================================
router.get("/", async (req, res) => {
  try {
    if (isManager(req)) {
      // MANAGER VIEW: Full details with pagination and search
      const page = parseInt(req.query.page) || 1;
      const search = req.query.search || "";
      const limit = 12;
      const offset = (page - 1) * limit;

      // Build query with optional search
      let query = db("donations")
        .select(
          "donations.*",
          "participants.participant_first_name",
          "participants.participant_last_name",
          "participants.participant_email"
        )
        .leftJoin("participants", "donations.participant_id", "participants.participant_id");
      
      let countQuery = db("donations")
        .leftJoin("participants", "donations.participant_id", "participants.participant_id");

      if (search) {
        const searchPattern = `%${search}%`;
        query = query.where(function() {
          this.whereRaw("LOWER(participants.participant_first_name) LIKE LOWER(?)", [searchPattern])
            .orWhereRaw("LOWER(participants.participant_last_name) LIKE LOWER(?)", [searchPattern])
            .orWhereRaw("LOWER(participants.participant_email) LIKE LOWER(?)", [searchPattern]);
        });
        countQuery = countQuery.where(function() {
          this.whereRaw("LOWER(participants.participant_first_name) LIKE LOWER(?)", [searchPattern])
            .orWhereRaw("LOWER(participants.participant_last_name) LIKE LOWER(?)", [searchPattern])
            .orWhereRaw("LOWER(participants.participant_email) LIKE LOWER(?)", [searchPattern]);
        });
      }

      const [{ count }] = await countQuery.count("donations.donation_id as count");
      const totalPages = Math.ceil(count / limit);

      // Get total donation amount (all donations, not just current page)
      const [{ total }] = await db("donations").sum("donation_amount as total");
      const totalDonationAmount = parseFloat(total || 0);

      const donations = await query
        .orderByRaw("CASE WHEN donations.donation_date IS NULL THEN 1 ELSE 0 END, donations.donation_date DESC")
        .limit(limit)
        .offset(offset);

      res.render("donations/index", {
        donations,
        totalDonations: totalDonationAmount,
        isManager: true,
        currentPage: page,
        totalPages,
        totalItems: parseInt(count),
        search
      });
    } else {
      // PARTICIPANT VIEW: Show their own donations + supporters list
      const page = parseInt(req.query.page) || 1;
      const search = req.query.search || "";
      const limit = 20; // 20 per page
      const offset = (page - 1) * limit;
      const participantId = req.session.user.participant_id;

      // Get this participant's own donations (if any)
      let myDonations = [];
      if (participantId) {
        myDonations = await db("donations")
          .select("donation_id", "donation_amount", "donation_date")
          .where("participant_id", participantId)
          .orderBy("donation_date", "desc");
      }

      // Build query for unique supporters with their most recent donation date
      let supportersQuery = db("donations")
        .select(
          "participants.participant_id",
          "participants.participant_first_name",
          "participants.participant_last_name"
        )
        .max("donations.donation_date as latest_donation")
        .leftJoin("participants", "donations.participant_id", "participants.participant_id")
        .groupBy("participants.participant_id", "participants.participant_first_name", "participants.participant_last_name");

      // Apply search filter
      if (search) {
        const searchPattern = `%${search}%`;
        supportersQuery = supportersQuery.having(function() {
          this.whereRaw("LOWER(participants.participant_first_name) LIKE LOWER(?)", [searchPattern])
            .orWhereRaw("LOWER(participants.participant_last_name) LIKE LOWER(?)", [searchPattern]);
        });
      }

      supportersQuery = supportersQuery.orderByRaw("MAX(donations.donation_date) DESC NULLS LAST");

      const supporters = await supportersQuery;

      // Manual pagination on the grouped results
      const totalSupporters = supporters.length;
      const totalPages = Math.ceil(totalSupporters / limit);
      const paginatedSupporters = supporters.slice(offset, offset + limit);

      res.render("donations/supporters", {
        donations: paginatedSupporters,
        myDonations,
        isManager: false,
        currentPage: page,
        totalPages,
        totalDonations: totalSupporters,
        search
      });
    }
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
