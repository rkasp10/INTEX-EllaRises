const express = require("express");
const router = express.Router();
const db = require("../db"); // Shared database connection

function isManager(req) {
  return req.session.user && req.session.user.level === "M";
}

// ============================================
// SURVEYS PAGE
// - Users: Fill out their surveys
// - Managers: View all survey responses
// ============================================
router.get("/", async (req, res) => {
  try {
    if (isManager(req)) {
      // Manager sees all survey responses with event info
      const surveys = await db("surveys")
        .select(
          "surveys.*",
          "registrations.registration_id",
          "event_templates.event_name",
          "participants.participant_first_name",
          "participants.participant_last_name"
        )
        .leftJoin("registrations", "surveys.registration_id", "registrations.registration_id")
        .leftJoin("event_occurrences", "registrations.occurrence_id", "event_occurrences.occurrence_id")
        .leftJoin("event_templates", "event_occurrences.template_id", "event_templates.template_id")
        .leftJoin("participants", "registrations.participant_id", "participants.participant_id")
        .orderBy("surveys.survey_submission_date", "desc");

      res.render("surveys/index", { surveys, isManager: true });
    } else {
      // User sees their pending and completed surveys
      const participantId = req.session.user.participant_id;

      // Get user's registrations that need surveys
      const pendingSurveys = await db("registrations")
        .select(
          "registrations.registration_id",
          "event_templates.event_name",
          "event_occurrences.event_datetime_start"
        )
        .leftJoin("event_occurrences", "registrations.occurrence_id", "event_occurrences.occurrence_id")
        .leftJoin("event_templates", "event_occurrences.template_id", "event_templates.template_id")
        .leftJoin("surveys", "registrations.registration_id", "surveys.registration_id")
        .where({ "registrations.participant_id": participantId })
        .whereNull("surveys.survey_id"); // No survey submitted yet

      const completedSurveys = await db("surveys")
        .select(
          "surveys.*",
          "event_templates.event_name"
        )
        .leftJoin("registrations", "surveys.registration_id", "registrations.registration_id")
        .leftJoin("event_occurrences", "registrations.occurrence_id", "event_occurrences.occurrence_id")
        .leftJoin("event_templates", "event_occurrences.template_id", "event_templates.template_id")
        .where({ "registrations.participant_id": participantId });

      res.render("surveys/user", { pendingSurveys, completedSurveys, isManager: false });
    }
  } catch (err) {
    console.error("Error loading surveys:", err);
    res.send("Error loading surveys: " + err.message);
  }
});

// ============================================
// SURVEY FORM (User fills out for a registration)
// ============================================
router.get("/fill/:registrationId", async (req, res) => {
  try {
    const registration = await db("registrations")
      .select(
        "registrations.registration_id",
        "event_templates.event_name",
        "event_occurrences.event_datetime_start"
      )
      .leftJoin("event_occurrences", "registrations.occurrence_id", "event_occurrences.occurrence_id")
      .leftJoin("event_templates", "event_occurrences.template_id", "event_templates.template_id")
      .where({ "registrations.registration_id": req.params.registrationId })
      .first();

    if (!registration) {
      return res.status(404).send("Registration not found");
    }

    res.render("surveys/fill", { registration });
  } catch (err) {
    console.error(err);
    res.send("Error loading survey form");
  }
});

// ============================================
// SUBMIT SURVEY (User)
// ============================================
router.post("/submit/:registrationId", async (req, res) => {
  try {
    const { 
      survey_satisfaction_score, 
      survey_usefulness_score, 
      survey_instructor_score,
      survey_overall_score,
      survey_comments,
      nps_rule_id
    } = req.body;

    await db("surveys").insert({
      registration_id: req.params.registrationId,
      survey_satisfaction_score: parseInt(survey_satisfaction_score),
      survey_usefulness_score: parseInt(survey_usefulness_score),
      survey_instructor_score: parseInt(survey_instructor_score),
      survey_overall_score: parseInt(survey_overall_score),
      survey_comments,
      survey_submission_date: new Date(),
      nps_rule_id: nps_rule_id ? parseInt(nps_rule_id) : null
    });

    res.redirect("/surveys");
  } catch (err) {
    console.error("Error submitting survey:", err);
    res.send("Error submitting survey: " + err.message);
  }
});

// ============================================
// VIEW SINGLE SURVEY (Manager)
// ============================================
router.get("/view/:id", async (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  
  try {
    const survey = await db("surveys")
      .select(
        "surveys.*",
        "event_templates.event_name",
        "participants.participant_first_name",
        "participants.participant_last_name"
      )
      .leftJoin("registrations", "surveys.registration_id", "registrations.registration_id")
      .leftJoin("event_occurrences", "registrations.occurrence_id", "event_occurrences.occurrence_id")
      .leftJoin("event_templates", "event_occurrences.template_id", "event_templates.template_id")
      .leftJoin("participants", "registrations.participant_id", "participants.participant_id")
      .where({ "surveys.survey_id": req.params.id })
      .first();

    if (!survey) return res.status(404).send("Survey not found");
    res.render("surveys/view", { survey });
  } catch (err) {
    console.error(err);
    res.send("Error loading survey");
  }
});

// ============================================
// DELETE SURVEY (Manager)
// ============================================
router.post("/delete/:id", async (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  
  try {
    await db("surveys").where({ survey_id: req.params.id }).del();
    res.redirect("/surveys");
  } catch (err) {
    console.error("Error deleting survey:", err);
    res.send("Error deleting survey: " + err.message);
  }
});

module.exports = router;
