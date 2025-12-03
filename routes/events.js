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
// LIST EVENTS (Event Occurrences with Template info)
// ============================================
router.get("/", async (req, res) => {
  try {
    const events = await db("event_occurrences")
      .select(
        "event_occurrences.occurrence_id",
        "event_occurrences.event_datetime_start",
        "event_occurrences.event_datetime_end",
        "event_occurrences.event_location",
        "event_occurrences.event_capacity",
        "event_occurrences.event_registration_deadline",
        "event_templates.template_id",
        "event_templates.event_name",
        "event_templates.event_type",
        "event_templates.event_description"
      )
      .leftJoin("event_templates", "event_occurrences.template_id", "event_templates.template_id")
      .orderBy("event_occurrences.event_datetime_start", "asc");

    res.render("events/index", {
      events,
      isManager: isManager(req)
    });
  } catch (err) {
    console.error("Error loading events:", err);
    res.send("Error loading events: " + err.message);
  }
});

// ============================================
// ADD EVENT FORM (Manager only)
// ============================================
router.get("/add", async (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  
  try {
    // Get templates for dropdown
    const templates = await db("event_templates").select("*");
    res.render("events/add", { templates });
  } catch (err) {
    console.error(err);
    res.render("events/add", { templates: [] });
  }
});

// ============================================
// CREATE EVENT OCCURRENCE (Manager only)
// ============================================
router.post("/add", async (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  
  try {
    const { 
      template_id, 
      event_datetime_start, 
      event_datetime_end, 
      event_location, 
      event_capacity, 
      event_registration_deadline 
    } = req.body;

    await db("event_occurrences").insert({
      template_id,
      event_datetime_start,
      event_datetime_end,
      event_location,
      event_capacity: parseInt(event_capacity),
      event_registration_deadline
    });

    res.redirect("/events");
  } catch (err) {
    console.error("Error adding event:", err);
    res.send("Error adding event: " + err.message);
  }
});

// ============================================
// EDIT EVENT FORM (Manager only)
// ============================================
router.get("/edit/:id", async (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  
  try {
    const event = await db("event_occurrences")
      .where({ occurrence_id: req.params.id })
      .first();
    
    const templates = await db("event_templates").select("*");

    if (!event) return res.status(404).send("Event not found");
    res.render("events/edit", { event, templates });
  } catch (err) {
    console.error(err);
    res.send("Error loading event");
  }
});

// ============================================
// UPDATE EVENT (Manager only)
// ============================================
router.post("/edit/:id", async (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  
  try {
    const { 
      template_id,
      event_datetime_start, 
      event_datetime_end, 
      event_location, 
      event_capacity,
      event_registration_deadline
    } = req.body;

    await db("event_occurrences")
      .where({ occurrence_id: req.params.id })
      .update({
        template_id,
        event_datetime_start,
        event_datetime_end,
        event_location,
        event_capacity: parseInt(event_capacity),
        event_registration_deadline
      });

    res.redirect("/events");
  } catch (err) {
    console.error("Error updating event:", err);
    res.send("Error updating event: " + err.message);
  }
});

// ============================================
// DELETE EVENT (Manager only)
// ============================================
router.post("/delete/:id", async (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  
  try {
    await db("event_occurrences").where({ occurrence_id: req.params.id }).del();
    res.redirect("/events");
  } catch (err) {
    console.error("Error deleting event:", err);
    res.send("Error deleting event: " + err.message);
  }
});

module.exports = router;
