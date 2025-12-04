const express = require("express");
const router = express.Router();
const db = require("../db"); // Shared database connection

function isManager(req) {
  return req.session.user && req.session.user.level === "M";
}

// ============================================
// MAIN EVENTS PAGE
// - Managers: See all events with full management
// - Participants: See their registered events
// ============================================
router.get("/", async (req, res) => {
  try {
    const filter = req.query.filter || "future";
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const now = new Date();

    if (isManager(req)) {
      // ========== ADMIN VIEW ==========
      const eventName = req.query.name || "";
      const eventType = req.query.type || "";
      const eventMonth = req.query.month || "";

      // Get filter options
      const eventTemplates = await db("event_templates")
        .select("template_id", "event_name")
        .orderBy("event_name");

      const eventTypes = await db("event_templates")
        .distinct("event_type")
        .whereNotNull("event_type")
        .orderBy("event_type");

      const monthsQuery = await db("event_occurrences")
        .select(db.raw("DISTINCT TO_CHAR(event_datetime_start::timestamp, 'YYYY-MM') as month_value, TO_CHAR(event_datetime_start::timestamp, 'Mon YYYY') as month_label"))
        .orderBy("month_value", "desc");

      // Build query for all events
      let query = db("event_occurrences")
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
        .leftJoin("event_templates", "event_occurrences.template_id", "event_templates.template_id");

      let countQuery = db("event_occurrences")
        .leftJoin("event_templates", "event_occurrences.template_id", "event_templates.template_id");

      // Apply filters
      if (filter === "past") {
        query = query.where("event_occurrences.event_datetime_start", "<", now);
        countQuery = countQuery.where("event_occurrences.event_datetime_start", "<", now);
      } else {
        query = query.where("event_occurrences.event_datetime_start", ">=", now);
        countQuery = countQuery.where("event_occurrences.event_datetime_start", ">=", now);
      }

      if (eventName) {
        query = query.where("event_templates.template_id", eventName);
        countQuery = countQuery.where("event_templates.template_id", eventName);
      }

      if (eventType) {
        query = query.where("event_templates.event_type", eventType);
        countQuery = countQuery.where("event_templates.event_type", eventType);
      }

      if (eventMonth) {
        query = query.whereRaw("TO_CHAR(event_occurrences.event_datetime_start::timestamp, 'YYYY-MM') = ?", [eventMonth]);
        countQuery = countQuery.whereRaw("TO_CHAR(event_occurrences.event_datetime_start::timestamp, 'YYYY-MM') = ?", [eventMonth]);
      }

      // Ordering
      if (filter === "past") {
        query = query.orderBy("event_occurrences.event_datetime_start", "desc");
      } else {
        query = query.orderBy("event_occurrences.event_datetime_start", "asc");
      }

      const [{ count }] = await countQuery.count("event_occurrences.occurrence_id as count");
      const totalPages = Math.ceil(count / limit);
      const events = await query.limit(limit).offset(offset);

      res.render("events/index", {
        events,
        isManager: true,
        filter,
        eventName,
        eventType,
        eventMonth,
        eventTemplates,
        eventTypes: eventTypes.map(t => t.event_type),
        eventMonths: monthsQuery,
        currentPage: page,
        totalPages,
        totalEvents: parseInt(count)
      });

    } else {
      // ========== PARTICIPANT VIEW ==========
      // Show only their registered events
      const participantId = req.session.user.participant_id;

      let query = db("registrations")
        .select(
          "registrations.registration_id",
          "registrations.registration_created_at",
          "event_occurrences.occurrence_id",
          "event_occurrences.event_datetime_start",
          "event_occurrences.event_datetime_end",
          "event_occurrences.event_location",
          "event_occurrences.event_capacity",
          "event_templates.event_name",
          "event_templates.event_type",
          "event_templates.event_description",
          "registration_status.status_text"
        )
        .leftJoin("event_occurrences", "registrations.occurrence_id", "event_occurrences.occurrence_id")
        .leftJoin("event_templates", "event_occurrences.template_id", "event_templates.template_id")
        .leftJoin("registration_status", "registrations.status_id", "registration_status.status_id")
        .where("registrations.participant_id", participantId);

      let countQuery = db("registrations")
        .leftJoin("event_occurrences", "registrations.occurrence_id", "event_occurrences.occurrence_id")
        .where("registrations.participant_id", participantId);

      // Apply past/future filter
      if (filter === "past") {
        query = query.where("event_occurrences.event_datetime_start", "<", now)
                     .orderBy("event_occurrences.event_datetime_start", "desc");
        countQuery = countQuery.where("event_occurrences.event_datetime_start", "<", now);
      } else {
        query = query.where("event_occurrences.event_datetime_start", ">=", now)
                     .orderBy("event_occurrences.event_datetime_start", "asc");
        countQuery = countQuery.where("event_occurrences.event_datetime_start", ">=", now);
      }

      const [{ count }] = await countQuery.count("registrations.registration_id as count");
      const totalPages = Math.ceil(count / limit);
      const events = await query.limit(limit).offset(offset);

      res.render("events/my-events", {
        events,
        isManager: false,
        filter,
        currentPage: page,
        totalPages,
        totalEvents: parseInt(count),
        registered: req.query.registered
      });
    }
  } catch (err) {
    console.error("Error loading events:", err);
    res.send("Error loading events: " + err.message);
  }
});

// ============================================
// BROWSE EVENTS (Participants - find events to register)
// ============================================
router.get("/browse", async (req, res) => {
  try {
    const eventName = req.query.name || "";
    const eventType = req.query.type || "";
    const eventMonth = req.query.month || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const now = new Date();
    const participantId = req.session.user.participant_id;

    // Get filter options
    const eventTemplates = await db("event_templates")
      .select("template_id", "event_name")
      .orderBy("event_name");

    const eventTypes = await db("event_templates")
      .distinct("event_type")
      .whereNotNull("event_type")
      .orderBy("event_type");

    const monthsQuery = await db("event_occurrences")
      .select(db.raw("DISTINCT TO_CHAR(event_datetime_start::timestamp, 'YYYY-MM') as month_value, TO_CHAR(event_datetime_start::timestamp, 'Mon YYYY') as month_label"))
      .where("event_datetime_start", ">=", now)
      .orderBy("month_value", "asc");

    // Get user's already registered event IDs
    const registeredEvents = await db("registrations")
      .select("occurrence_id")
      .where("participant_id", participantId);
    const registeredIds = registeredEvents.map(r => r.occurrence_id);

    // Build query for available future events
    let query = db("event_occurrences")
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
      .where("event_occurrences.event_datetime_start", ">=", now);

    let countQuery = db("event_occurrences")
      .leftJoin("event_templates", "event_occurrences.template_id", "event_templates.template_id")
      .where("event_occurrences.event_datetime_start", ">=", now);

    // Exclude already registered events
    if (registeredIds.length > 0) {
      query = query.whereNotIn("event_occurrences.occurrence_id", registeredIds);
      countQuery = countQuery.whereNotIn("event_occurrences.occurrence_id", registeredIds);
    }

    // Apply filters
    if (eventName) {
      query = query.where("event_templates.template_id", eventName);
      countQuery = countQuery.where("event_templates.template_id", eventName);
    }

    if (eventType) {
      query = query.where("event_templates.event_type", eventType);
      countQuery = countQuery.where("event_templates.event_type", eventType);
    }

    if (eventMonth) {
      query = query.whereRaw("TO_CHAR(event_occurrences.event_datetime_start::timestamp, 'YYYY-MM') = ?", [eventMonth]);
      countQuery = countQuery.whereRaw("TO_CHAR(event_occurrences.event_datetime_start::timestamp, 'YYYY-MM') = ?", [eventMonth]);
    }

    query = query.orderBy("event_occurrences.event_datetime_start", "asc");

    const [{ count }] = await countQuery.count("event_occurrences.occurrence_id as count");
    const totalPages = Math.ceil(count / limit);
    const events = await query.limit(limit).offset(offset);

    res.render("events/browse", {
      events,
      isManager: isManager(req),
      eventName,
      eventType,
      eventMonth,
      eventTemplates,
      eventTypes: eventTypes.map(t => t.event_type),
      eventMonths: monthsQuery,
      currentPage: page,
      totalPages,
      totalEvents: parseInt(count),
      error: req.query.error
    });
  } catch (err) {
    console.error("Error loading browse events:", err);
    res.send("Error loading events: " + err.message);
  }
});

// ============================================
// REGISTER FOR EVENT (Participant)
// ============================================
router.post("/register/:id", async (req, res) => {
  try {
    const participantId = req.session.user.participant_id;
    const occurrenceId = req.params.id;

    // Check if already registered
    const existing = await db("registrations")
      .where({ participant_id: participantId, occurrence_id: occurrenceId })
      .first();

    if (existing) {
      return res.redirect("/events/browse?error=already_registered");
    }

    // Get default status (assuming status_id 1 is "Registered" or similar)
    const defaultStatus = await db("registration_status").first();

    await db("registrations").insert({
      participant_id: participantId,
      occurrence_id: occurrenceId,
      status_id: defaultStatus ? defaultStatus.status_id : 1,
      registration_created_at: new Date()
    });

    res.redirect("/events?registered=success");
  } catch (err) {
    console.error("Error registering for event:", err);
    res.send("Error registering: " + err.message);
  }
});

// ============================================
// UNREGISTER FROM EVENT (Participant)
// ============================================
router.post("/unregister/:id", async (req, res) => {
  try {
    const participantId = req.session.user.participant_id;
    const registrationId = req.params.id;

    await db("registrations")
      .where({ registration_id: registrationId, participant_id: participantId })
      .del();

    res.redirect("/events");
  } catch (err) {
    console.error("Error unregistering:", err);
    res.send("Error unregistering: " + err.message);
  }
});

// ============================================
// ADD EVENT FORM (Manager only)
// ============================================
router.get("/add", async (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  
  try {
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
