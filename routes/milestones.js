// This file houses all of the routes for the milestones views.


const express = require("express");
const router = express.Router();
const db = require("../db"); // Shared database connection

function isManager(req) {
  return req.session.user && req.session.user.level === "M";
}

// ============================================
// MILESTONES PAGE
// - Users: See their achieved milestones
// - Managers: Manage milestone assignments
// ============================================
router.get("/", async (req, res) => {
  try {
    if (isManager(req)) {
      // Manager sees all milestones with participant info (paginated + search)
      const page = parseInt(req.query.page) || 1;
      const search = req.query.search || "";
      const limit = 12;
      const offset = (page - 1) * limit;

      let query = db("milestones")
        .select(
          "milestones.*",
          "participants.participant_first_name",
          "participants.participant_last_name"
        )
        .leftJoin("participants", "milestones.participant_id", "participants.participant_id");
      
      let countQuery = db("milestones")
        .leftJoin("participants", "milestones.participant_id", "participants.participant_id");

      if (search) {
        const searchPattern = `%${search}%`;
        query = query.where(function() {
          this.whereRaw("LOWER(participants.participant_first_name) LIKE LOWER(?)", [searchPattern])
            .orWhereRaw("LOWER(participants.participant_last_name) LIKE LOWER(?)", [searchPattern])
            .orWhereRaw("LOWER(milestones.milestone_title) LIKE LOWER(?)", [searchPattern]);
        });
        countQuery = countQuery.where(function() {
          this.whereRaw("LOWER(participants.participant_first_name) LIKE LOWER(?)", [searchPattern])
            .orWhereRaw("LOWER(participants.participant_last_name) LIKE LOWER(?)", [searchPattern])
            .orWhereRaw("LOWER(milestones.milestone_title) LIKE LOWER(?)", [searchPattern]);
        });
      }

      const [{ count }] = await countQuery.count("milestones.milestone_id as count");
      const totalPages = Math.ceil(count / limit);

      const milestones = await query
        .orderBy("milestones.milestone_date", "desc")
        .limit(limit)
        .offset(offset);

      res.render("milestones/index", { 
        milestones, 
        isManager: true,
        currentPage: page,
        totalPages,
        totalItems: parseInt(count),
        search
      });
    } else {
      // User sees their own milestones
      const participantId = req.session.user.participant_id;
      
      const milestones = await db("milestones")
        .select("*")
        .where({ participant_id: participantId })
        .orderBy("milestone_date", "desc");

      res.render("milestones/user", { milestones, isManager: false });
    }
  } catch (err) {
    console.error("Error loading milestones:", err);
    res.send("Error loading milestones: " + err.message);
  }
});

// ============================================
// ADD MILESTONE FORM (Manager)
// ============================================
router.get("/add", async (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  
  try {
    // Get participants for dropdown
    const participants = await db("participants")
      .select("participant_id", "participant_first_name", "participant_last_name")
      .orderBy("participant_last_name");

    res.render("milestones/add", { participants });
  } catch (err) {
    console.error(err);
    res.render("milestones/add", { participants: [] });
  }
});

// ============================================
// CREATE MILESTONE (Manager)
// ============================================
router.post("/add", async (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  
  try {
    const { milestone_title, milestone_date, participant_id } = req.body;

    await db("milestones").insert({
      milestone_title,
      milestone_date,
      participant_id: parseInt(participant_id)
    });

    res.redirect("/milestones");
  } catch (err) {
    console.error("Error adding milestone:", err);
    res.send("Error adding milestone: " + err.message);
  }
});

// ============================================
// EDIT MILESTONE FORM (Manager)
// ============================================
router.get("/edit/:id", async (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  
  try {
    const milestone = await db("milestones")
      .where({ milestone_id: req.params.id })
      .first();

    const participants = await db("participants")
      .select("participant_id", "participant_first_name", "participant_last_name")
      .orderBy("participant_last_name");

    if (!milestone) return res.status(404).send("Milestone not found");
    res.render("milestones/edit", { milestone, participants });
  } catch (err) {
    console.error(err);
    res.send("Error loading milestone");
  }
});

// ============================================
// UPDATE MILESTONE (Manager)
// ============================================
router.post("/edit/:id", async (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  
  try {
    const { milestone_title, milestone_date, participant_id } = req.body;

    await db("milestones")
      .where({ milestone_id: req.params.id })
      .update({
        milestone_title,
        milestone_date,
        participant_id: parseInt(participant_id)
      });

    res.redirect("/milestones");
  } catch (err) {
    console.error("Error updating milestone:", err);
    res.send("Error updating milestone: " + err.message);
  }
});

// ============================================
// DELETE MILESTONE (Manager)
// ============================================
router.post("/delete/:id", async (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  
  try {
    await db("milestones").where({ milestone_id: req.params.id }).del();
    res.redirect("/milestones");
  } catch (err) {
    console.error("Error deleting milestone:", err);
    res.send("Error deleting milestone: " + err.message);
  }
});

module.exports = router;
