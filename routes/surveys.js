const express = require("express");
const router = express.Router();
const db = require("../db"); // Shared database connection

function isManager(req) {
  return req.session.user && req.session.user.level === "M";
}

// ============================================
// SURVEYS PAGE
// - Users: Fill out their surveys
// - Managers: View filtered survey responses with aggregates
// ============================================
router.get("/", async (req, res) => {
  try {
    if (isManager(req)) {
      // Get filter params
      const eventType = req.query.type || "";
      const eventName = req.query.name || "";
      const filterYear = req.query.year || "";
      const filterMonth = req.query.month || "";
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;

      // Get filter options
      const eventTypes = await db("event_templates")
        .distinct("event_type")
        .whereNotNull("event_type")
        .orderBy("event_type");

      // Filter event templates by selected event type (for cascading dropdown)
      let eventTemplatesQuery = db("event_templates")
        .select("template_id", "event_name", "event_type")
        .orderBy("event_name");
      
      if (eventType) {
        eventTemplatesQuery = eventTemplatesQuery.where("event_type", eventType);
      }
      
      const eventTemplates = await eventTemplatesQuery;

      // Get available years from survey submissions
      const availableYears = await db("surveys")
        .select(db.raw("DISTINCT EXTRACT(YEAR FROM survey_submission_date::timestamp) as year"))
        .whereNotNull("survey_submission_date")
        .orderBy("year", "desc");

      // Get available months (1-12)
      const months = [
        { value: '1', label: 'January' },
        { value: '2', label: 'February' },
        { value: '3', label: 'March' },
        { value: '4', label: 'April' },
        { value: '5', label: 'May' },
        { value: '6', label: 'June' },
        { value: '7', label: 'July' },
        { value: '8', label: 'August' },
        { value: '9', label: 'September' },
        { value: '10', label: 'October' },
        { value: '11', label: 'November' },
        { value: '12', label: 'December' }
      ];

      // Get NPS rules for reference
      const npsRules = await db("nps_rules").select("*").orderBy("nps_rule_id");

      // Build survey query with filters
      let query = db("surveys")
        .select(
          "surveys.*",
          "registrations.registration_id",
          "event_templates.event_name",
          "event_templates.event_type",
          "event_templates.template_id",
          "event_occurrences.occurrence_id",
          "event_occurrences.event_datetime_start",
          "participants.participant_first_name",
          "participants.participant_last_name",
          "nps_rules.recommendation_score",
          "nps_buckets.bucket_name"
        )
        .leftJoin("registrations", "surveys.registration_id", "registrations.registration_id")
        .leftJoin("event_occurrences", "registrations.occurrence_id", "event_occurrences.occurrence_id")
        .leftJoin("event_templates", "event_occurrences.template_id", "event_templates.template_id")
        .leftJoin("participants", "registrations.participant_id", "participants.participant_id")
        .leftJoin("nps_rules", "surveys.nps_rule_id", "nps_rules.nps_rule_id")
        .leftJoin("nps_buckets", "nps_rules.bucket_id", "nps_buckets.bucket_id");

      let countQuery = db("surveys")
        .leftJoin("registrations", "surveys.registration_id", "registrations.registration_id")
        .leftJoin("event_occurrences", "registrations.occurrence_id", "event_occurrences.occurrence_id")
        .leftJoin("event_templates", "event_occurrences.template_id", "event_templates.template_id");

      // Apply filters
      if (eventType) {
        query = query.where("event_templates.event_type", eventType);
        countQuery = countQuery.where("event_templates.event_type", eventType);
      }

      if (eventName) {
        query = query.where("event_templates.template_id", eventName);
        countQuery = countQuery.where("event_templates.template_id", eventName);
      }

      // Apply year filter
      if (filterYear) {
        query = query.whereRaw("EXTRACT(YEAR FROM surveys.survey_submission_date::timestamp) = ?", [filterYear]);
        countQuery = countQuery.whereRaw("EXTRACT(YEAR FROM surveys.survey_submission_date::timestamp) = ?", [filterYear]);
      }

      // Apply month filter
      if (filterMonth) {
        query = query.whereRaw("EXTRACT(MONTH FROM surveys.survey_submission_date::timestamp) = ?", [filterMonth]);
        countQuery = countQuery.whereRaw("EXTRACT(MONTH FROM surveys.survey_submission_date::timestamp) = ?", [filterMonth]);
      }

      // Get count for pagination
      const [{ count }] = await countQuery.count("surveys.survey_id as count");
      const totalPages = Math.ceil(count / limit);

      // Get paginated results
      const surveys = await query
        .orderBy("surveys.survey_submission_date", "desc")
        .limit(limit)
        .offset(offset);

      // Get total unfiltered count for the header note
      const totalCountResult = await db("surveys").count("* as count").first();
      const totalAllTime = parseInt(totalCountResult.count) || 0;

      // Calculate aggregate stats for filtered results
      let statsQuery = db("surveys")
        .leftJoin("registrations", "surveys.registration_id", "registrations.registration_id")
        .leftJoin("event_occurrences", "registrations.occurrence_id", "event_occurrences.occurrence_id")
        .leftJoin("event_templates", "event_occurrences.template_id", "event_templates.template_id")
        .leftJoin("nps_rules", "surveys.nps_rule_id", "nps_rules.nps_rule_id");

      if (eventType) {
        statsQuery = statsQuery.where("event_templates.event_type", eventType);
      }
      if (eventName) {
        statsQuery = statsQuery.where("event_templates.template_id", eventName);
      }
      if (filterYear) {
        statsQuery = statsQuery.whereRaw("EXTRACT(YEAR FROM surveys.survey_submission_date::timestamp) = ?", [filterYear]);
      }
      if (filterMonth) {
        statsQuery = statsQuery.whereRaw("EXTRACT(MONTH FROM surveys.survey_submission_date::timestamp) = ?", [filterMonth]);
      }

      const stats = await statsQuery.select(
        db.raw("AVG(surveys.survey_satisfaction_score) as avg_satisfaction"),
        db.raw("AVG(surveys.survey_usefulness_score) as avg_usefulness"),
        db.raw("AVG(surveys.survey_instructor_score) as avg_instructor"),
        db.raw("AVG(nps_rules.recommendation_score) as avg_recommendation"),
        db.raw("AVG(surveys.survey_overall_score) as avg_overall"),
        db.raw("COUNT(*) as total_responses")
      ).first();

      res.render("surveys/index", { 
        surveys, 
        isManager: true,
        eventType,
        eventName,
        filterYear,
        filterMonth,
        eventTypes: eventTypes.map(t => t.event_type),
        eventTemplates,
        availableYears: availableYears.map(y => y.year),
        months,
        npsRules,
        stats: {
          avgSatisfaction: stats.avg_satisfaction ? parseFloat(stats.avg_satisfaction).toFixed(2) : null,
          avgUsefulness: stats.avg_usefulness ? parseFloat(stats.avg_usefulness).toFixed(2) : null,
          avgInstructor: stats.avg_instructor ? parseFloat(stats.avg_instructor).toFixed(2) : null,
          avgRecommendation: stats.avg_recommendation ? parseFloat(stats.avg_recommendation).toFixed(2) : null,
          avgOverall: stats.avg_overall ? parseFloat(stats.avg_overall).toFixed(2) : null,
          totalResponses: parseInt(stats.total_responses)
        },
        currentPage: page,
        totalPages,
        totalSurveys: parseInt(count),
        totalAllTime
      });
    } else {
      // User sees their pending and completed surveys
      const participantId = req.session.user.participant_id;

      // Get user's registrations that need surveys (past events only)
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
        .where("event_occurrences.event_datetime_start", "<", new Date()) // Only past events
        .whereNull("surveys.survey_id"); // No survey submitted yet

      const completedSurveys = await db("surveys")
        .select(
          "surveys.*",
          "event_templates.event_name",
          "event_occurrences.event_datetime_start"
        )
        .leftJoin("registrations", "surveys.registration_id", "registrations.registration_id")
        .leftJoin("event_occurrences", "registrations.occurrence_id", "event_occurrences.occurrence_id")
        .leftJoin("event_templates", "event_occurrences.template_id", "event_templates.template_id")
        .where({ "registrations.participant_id": participantId })
        .orderBy("surveys.survey_submission_date", "desc");

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

    // Get NPS rules for the recommendation question
    const npsRules = await db("nps_rules").select("*").orderBy("nps_rule_id");

    res.render("surveys/fill", { registration, npsRules });
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
      survey_recommendation_score,
      survey_comments
    } = req.body;

    // Calculate overall as average of all 4 scores
    const satisfaction = parseInt(survey_satisfaction_score);
    const usefulness = parseInt(survey_usefulness_score);
    const instructor = parseInt(survey_instructor_score);
    const recommendation = parseInt(survey_recommendation_score);
    const overall = Math.round((satisfaction + usefulness + instructor + recommendation) / 4);

    // Determine NPS rule based on recommendation score
    // First try exact match on recommendation_score column
    let npsRule = await db("nps_rules")
      .where("recommendation_score", recommendation)
      .first();
    
    // Fallback to range match if no exact match
    if (!npsRule) {
      npsRule = await db("nps_rules")
        .where("nps_min_score", "<=", recommendation)
        .andWhere("nps_max_score", ">=", recommendation)
        .first();
    }

    await db("surveys").insert({
      registration_id: req.params.registrationId,
      survey_satisfaction_score: satisfaction,
      survey_usefulness_score: usefulness,
      survey_instructor_score: instructor,
      survey_overall_score: overall,
      survey_comments,
      survey_submission_date: new Date(),
      nps_rule_id: npsRule ? npsRule.nps_rule_id : null
    });

    res.redirect("/surveys?submitted=success");
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
        "event_templates.event_type",
        "event_occurrences.event_datetime_start",
        "event_occurrences.event_location",
        "participants.participant_first_name",
        "participants.participant_last_name",
        "participants.participant_email",
        "nps_rules.recommendation_score",
        "nps_buckets.bucket_name"
      )
      .leftJoin("registrations", "surveys.registration_id", "registrations.registration_id")
      .leftJoin("event_occurrences", "registrations.occurrence_id", "event_occurrences.occurrence_id")
      .leftJoin("event_templates", "event_occurrences.template_id", "event_templates.template_id")
      .leftJoin("participants", "registrations.participant_id", "participants.participant_id")
      .leftJoin("nps_rules", "surveys.nps_rule_id", "nps_rules.nps_rule_id")
      .leftJoin("nps_buckets", "nps_rules.bucket_id", "nps_buckets.bucket_id")
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
