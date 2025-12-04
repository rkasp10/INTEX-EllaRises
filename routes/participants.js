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
      // MANAGER VIEW: Show all participants
      const participants = await db("participants").select("*");
      res.render("participants/index", {
        participants,
        isManager: true
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
    const { participant_first_name, participant_last_name, participant_email, participant_dob, participant_phone, participant_city, participant_state, participant_zip } = req.body;
    
    await db("participants")
      .where({ participant_id: req.params.id })
      .update({
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
