const express = require("express");
const router = express.Router();
const db = require("../db"); // Shared database connection

// Helper: Check if user is manager
function isManager(req) {
  return req.session.user && req.session.user.level === "M";
}

// ============================================
// PARTICIPANTS PAGE
// - Managers: See all participants with CRUD
// - Regular Users: See only their own profile
// ============================================
router.get("/", async (req, res) => {
  try {
    if (isManager(req)) {
      // MANAGER VIEW: Show all participants with pagination and search
      const page = parseInt(req.query.page) || 1;
      const search = req.query.search || "";
      const limit = 12;
      const offset = (page - 1) * limit;

      // Build query with optional search
      let query = db("participants");
      let countQuery = db("participants");

      if (search) {
        const searchPattern = `%${search}%`;
        query = query.where(function() {
          this.whereRaw("LOWER(participant_first_name) LIKE LOWER(?)", [searchPattern])
            .orWhereRaw("LOWER(participant_last_name) LIKE LOWER(?)", [searchPattern])
            .orWhereRaw("LOWER(participant_email) LIKE LOWER(?)", [searchPattern])
            .orWhereRaw("LOWER(participant_city) LIKE LOWER(?)", [searchPattern]);
        });
        countQuery = countQuery.where(function() {
          this.whereRaw("LOWER(participant_first_name) LIKE LOWER(?)", [searchPattern])
            .orWhereRaw("LOWER(participant_last_name) LIKE LOWER(?)", [searchPattern])
            .orWhereRaw("LOWER(participant_email) LIKE LOWER(?)", [searchPattern])
            .orWhereRaw("LOWER(participant_city) LIKE LOWER(?)", [searchPattern]);
        });
      }

      const [{ count }] = await countQuery.count("participant_id as count");
      const totalPages = Math.ceil(count / limit);

      const participants = await query
        .select("*")
        .orderBy("participant_last_name")
        .limit(limit)
        .offset(offset);

      res.render("participants/index", {
        participants,
        isManager: true,
        currentPage: page,
        totalPages,
        totalItems: parseInt(count),
        search
      });
    } else {
      // USER VIEW: Show only their own profile
      // For now, show first participant as demo (needs user-participant linking)
      const participant = await db("participants")
        .where({ participant_id: req.session.user.participant_id })
        .first();
      
      res.render("participants/profile", {
        participant,
        isManager: false
      });
    }
  } catch (err) {
    console.error(err);
    res.send("Error loading participants");
  }
});

// ============================================
// ADD PARTICIPANT FORM (Manager only)
// ============================================
router.get("/add", (req, res) => {
  if (!isManager(req)) {
    return res.status(403).send("Access denied. Managers only.");
  }
  res.render("participants/add");
});

// ============================================
// CREATE PARTICIPANT (Manager only)
// ============================================
router.post("/add", async (req, res) => {
  if (!isManager(req)) {
    return res.status(403).send("Access denied. Managers only.");
  }
  
  try {
    const { participant_first_name, participant_last_name, participant_email, participant_dob, participant_phone, participant_city, participant_state, participant_zip } = req.body;
    
    await db("participants").insert({
      participant_first_name,
      participant_last_name,
      participant_email,
      participant_dob,
      participant_phone,
      participant_city,
      participant_state,
      participant_zip
    });
    
    res.redirect("/participants");
  } catch (err) {
    console.error(err);
    res.send("Error adding participant");
  }
});

// ============================================
// EDIT PARTICIPANT FORM (Manager only)
// ============================================
router.get("/edit/:id", async (req, res) => {
  if (!isManager(req)) {
    return res.status(403).send("Access denied. Managers only.");
  }
  
  try {
    const participant = await db("participants")
      .where({ participant_id: req.params.id })
      .first();
    
    if (!participant) {
      return res.status(404).send("Participant not found");
    }
    
    res.render("participants/edit", { participant });
  } catch (err) {
    console.error(err);
    res.send("Error loading participant");
  }
});

// ============================================
// UPDATE PARTICIPANT (Manager only)
// ============================================
router.post("/edit/:id", async (req, res) => {
  if (!isManager(req)) {
    return res.status(403).send("Access denied. Managers only.");
  }
  
  try {
    const { 
      participant_first_name, participant_last_name, participant_email, 
      participant_dob, participant_phone, participant_city, participant_state, participant_zip,
      participant_school_or_employer, participant_field_of_interest, participant_role
    } = req.body;
    
    await db("participants")
      .where({ participant_id: req.params.id })
      .update({
        participant_first_name,
        participant_last_name,
        participant_email,
        participant_dob: participant_dob || null,
        participant_phone: participant_phone || null,
        participant_city: participant_city || null,
        participant_state: participant_state || null,
        participant_zip: participant_zip || null,
        participant_school_or_employer: participant_school_or_employer || null,
        participant_field_of_interest: participant_field_of_interest || null,
        participant_role: participant_role || null
      });
    
    res.redirect("/participants");
  } catch (err) {
    console.error(err);
    res.send("Error updating participant");
  }
});

// ============================================
// DELETE PARTICIPANT (Manager only)
// ============================================
router.post("/delete/:id", async (req, res) => {
  if (!isManager(req)) {
    return res.status(403).send("Access denied. Managers only.");
  }
  
  try {
    await db("participants").where({ participant_id: req.params.id }).del();
    res.redirect("/participants");
  } catch (err) {
    console.error(err);
    res.send("Error deleting participant");
  }
});

module.exports = router;
