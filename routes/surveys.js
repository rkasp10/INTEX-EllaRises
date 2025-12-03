const express = require("express");
const router = express.Router();

// ============================================
// MOCK DATA
// ============================================
let mockSurveys = [
  { id: 1, event_name: "Ballet Folklórico Classes", participant_name: "Sofia Garcia", satisfaction: 5, usefulness: 5, recommend: 10, comments: "Loved learning about my culture!", submitted_date: "2024-11-15" },
  { id: 2, event_name: "STEAM Workshop: Robotics", participant_name: "Isabella Martinez", satisfaction: 4, usefulness: 5, recommend: 9, comments: "Really fun! Want more robotics classes.", submitted_date: "2024-11-20" },
  { id: 3, event_name: "Leadership Summit", participant_name: "Camila Rodriguez", satisfaction: 5, usefulness: 4, recommend: 8, comments: "Great speakers and activities.", submitted_date: "2024-11-22" },
  { id: 4, event_name: "STEAM Workshop: Robotics", participant_name: "Emma Hernandez", satisfaction: 5, usefulness: 5, recommend: 10, comments: "Best workshop ever!", submitted_date: "2024-11-25" },
];

// Mock survey for current user
const mockUserSurvey = { id: 5, event_id: 1, event_name: "Ballet Folklórico Classes", satisfaction: null, usefulness: null, recommend: null, comments: "" };

function isManager(req) {
  return req.session.user && req.session.user.level === "M";
}

// ============================================
// SURVEYS PAGE
// - Users: Fill out their surveys
// - Managers: View all survey responses
// ============================================
router.get("/", (req, res) => {
  if (isManager(req)) {
    // Manager sees all survey responses
    res.render("surveys/index", { surveys: mockSurveys, isManager: true });
  } else {
    // User sees surveys they need to fill out
    res.render("surveys/user", { pendingSurvey: mockUserSurvey, completedSurveys: [], isManager: false });
  }
});

// SUBMIT SURVEY (User)
router.post("/submit/:id", (req, res) => {
  const { satisfaction, usefulness, recommend, comments } = req.body;
  // TODO: Save to database
  console.log("Survey submitted:", { satisfaction, usefulness, recommend, comments });
  res.redirect("/surveys");
});

// VIEW SINGLE SURVEY (Manager)
router.get("/view/:id", (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  const survey = mockSurveys.find(s => s.id === parseInt(req.params.id));
  if (!survey) return res.status(404).send("Survey not found");
  res.render("surveys/view", { survey });
});

// DELETE SURVEY (Manager)
router.post("/delete/:id", (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  mockSurveys = mockSurveys.filter(s => s.id !== parseInt(req.params.id));
  res.redirect("/surveys");
});

module.exports = router;
