const express = require("express");
const router = express.Router();

// ============================================
// MOCK DATA
// ============================================
let mockMilestones = [
  { id: 1, name: "First Event Attended", description: "Attended your first Ella Rises event", icon: "🌟" },
  { id: 2, name: "5 Events Attended", description: "Attended 5 Ella Rises events", icon: "⭐" },
  { id: 3, name: "Survey Champion", description: "Completed 3 post-event surveys", icon: "📝" },
  { id: 4, name: "STEAM Explorer", description: "Attended a STEAM workshop", icon: "🔬" },
  { id: 5, name: "Cultural Ambassador", description: "Participated in a cultural heritage event", icon: "💃" },
  { id: 6, name: "Leadership Star", description: "Completed leadership training", icon: "👑" },
];

// User's achieved milestones (mock)
const mockUserMilestones = [
  { milestone_id: 1, achieved_date: "2024-09-15" },
  { milestone_id: 4, achieved_date: "2024-10-20" },
];

function isManager(req) {
  return req.session.user && req.session.user.level === "M";
}

// ============================================
// MILESTONES PAGE
// - Users: See their achieved milestones
// - Managers: Manage milestone definitions & assignments
// ============================================
router.get("/", (req, res) => {
  if (isManager(req)) {
    res.render("milestones/index", { milestones: mockMilestones, isManager: true });
  } else {
    // Combine milestone data with user's achievements
    const userMilestones = mockMilestones.map(m => ({
      ...m,
      achieved: mockUserMilestones.find(um => um.milestone_id === m.id),
    }));
    res.render("milestones/user", { milestones: userMilestones, isManager: false });
  }
});

// ADD MILESTONE (Manager)
router.get("/add", (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  res.render("milestones/add");
});

router.post("/add", (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  const { name, description, icon } = req.body;
  mockMilestones.push({ id: mockMilestones.length + 1, name, description, icon: icon || "🏆" });
  res.redirect("/milestones");
});

// EDIT MILESTONE (Manager)
router.get("/edit/:id", (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  const milestone = mockMilestones.find(m => m.id === parseInt(req.params.id));
  if (!milestone) return res.status(404).send("Milestone not found");
  res.render("milestones/edit", { milestone });
});

router.post("/edit/:id", (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  const { name, description, icon } = req.body;
  const index = mockMilestones.findIndex(m => m.id === parseInt(req.params.id));
  if (index !== -1) {
    mockMilestones[index] = { ...mockMilestones[index], name, description, icon };
  }
  res.redirect("/milestones");
});

// DELETE MILESTONE (Manager)
router.post("/delete/:id", (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  mockMilestones = mockMilestones.filter(m => m.id !== parseInt(req.params.id));
  res.redirect("/milestones");
});

module.exports = router;
