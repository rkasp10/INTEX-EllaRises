const express = require("express");
const router = express.Router();
const knex = require("knex");

// Database connection (import from app or create here)
const db = knex({
  client: "pg",
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
});

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
        .where({ participantemail: req.session.user.username + "@example.com" })
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
    const { participantfirstname, participantlastname, participantemail, participantdob, participantphone, participantcity, participantstate, participantzip } = req.body;
    
    await db("participants").insert({
      participantfirstname,
      participantlastname,
      participantemail,
      participantdob,
      participantphone,
      participantcity,
      participantstate,
      participantzip
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
      .where({ participantid: req.params.id })
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
    const { participantfirstname, participantlastname, participantemail, participantdob, participantphone, participantcity, participantstate, participantzip } = req.body;
    
    await db("participants")
      .where({ participantid: req.params.id })
      .update({
        participantfirstname,
        participantlastname,
        participantemail,
        participantdob,
        participantphone,
        participantcity,
        participantstate,
        participantzip
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
    await db("participants").where({ participantid: req.params.id }).del();
    res.redirect("/participants");
  } catch (err) {
    console.error(err);
    res.send("Error deleting participant");
  }
});

module.exports = router;
