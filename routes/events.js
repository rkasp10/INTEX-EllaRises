const express = require("express");
const router = express.Router();

// ============================================
// MOCK DATA (Replace with database queries later)
// ============================================
let mockEvents = [
  { id: 1, name: "Ballet Folklórico Classes", description: "Traditional Mexican folk dance classes for young women", event_date: "2024-12-08", time: "19:00", location: "Provo Mall", capacity: 25, registered: 18 },
  { id: 2, name: "STEAM Workshop: Robotics", description: "Introduction to robotics and programming", event_date: "2024-12-15", time: "10:00", location: "UVU Campus", capacity: 20, registered: 20 },
  { id: 3, name: "Leadership Summit", description: "Building confidence and leadership skills", event_date: "2024-12-20", time: "09:00", location: "BYU Conference Center", capacity: 50, registered: 35 },
  { id: 4, name: "Art & Heritage Day", description: "Exploring cultural heritage through art", event_date: "2025-01-10", time: "14:00", location: "Provo Recreation Center", capacity: 30, registered: 12 },
];

function isManager(req) {
  return req.session.user && req.session.user.level === "M";
}

// ============================================
// LIST EVENTS
// - Users: View events and register
// - Managers: Full CRUD
// ============================================
router.get("/", (req, res) => {
  const events = mockEvents;
  res.render("events/index", {
    events,
    isManager: isManager(req)
  });
});

// ADD EVENT FORM (Manager only)
router.get("/add", (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  res.render("events/add");
});

// CREATE EVENT (Manager only)
router.post("/add", (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  const { name, description, event_date, time, location, capacity } = req.body;
  const newEvent = {
    id: mockEvents.length + 1,
    name, description, event_date, time, location,
    capacity: parseInt(capacity),
    registered: 0
  };
  mockEvents.push(newEvent);
  res.redirect("/events");
});

// EDIT EVENT FORM (Manager only)
router.get("/edit/:id", (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  const event = mockEvents.find(e => e.id === parseInt(req.params.id));
  if (!event) return res.status(404).send("Event not found");
  res.render("events/edit", { event });
});

// UPDATE EVENT (Manager only)
router.post("/edit/:id", (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  const { name, description, event_date, time, location, capacity } = req.body;
  const index = mockEvents.findIndex(e => e.id === parseInt(req.params.id));
  if (index !== -1) {
    mockEvents[index] = { ...mockEvents[index], name, description, event_date, time, location, capacity: parseInt(capacity) };
  }
  res.redirect("/events");
});

// DELETE EVENT (Manager only)
router.post("/delete/:id", (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  mockEvents = mockEvents.filter(e => e.id !== parseInt(req.params.id));
  res.redirect("/events");
});

module.exports = router;
