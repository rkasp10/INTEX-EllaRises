const express = require("express");
const router = express.Router();

// ============================================
// MOCK DATA
// ============================================
let mockUsers = [
  { id: 1, username: "admin", email: "admin@ellarises.org", level: "M", created_date: "2024-01-01" },
  { id: 2, username: "manager1", email: "manager@ellarises.org", level: "M", created_date: "2024-02-15" },
  { id: 3, username: "sofia_g", email: "sofia@example.com", level: "U", created_date: "2024-03-15" },
  { id: 4, username: "isabella_m", email: "isabella@example.com", level: "U", created_date: "2024-04-20" },
  { id: 5, username: "camila_r", email: "camila@example.com", level: "U", created_date: "2024-05-10" },
];

// Note: This route is already protected by requireManager in app.js

// ============================================
// USERS LIST (Manager only)
// ============================================
router.get("/", (req, res) => {
  res.render("users/index", { users: mockUsers });
});

// ADD USER FORM
router.get("/add", (req, res) => {
  res.render("users/add");
});

// CREATE USER
router.post("/add", (req, res) => {
  const { username, email, password, level } = req.body;
  // TODO: Hash password with bcrypt
  mockUsers.push({
    id: mockUsers.length + 1,
    username, email, level,
    created_date: new Date().toISOString().split("T")[0]
  });
  res.redirect("/users");
});

// EDIT USER FORM
router.get("/edit/:id", (req, res) => {
  const user = mockUsers.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).send("User not found");
  res.render("users/edit", { user });
});

// UPDATE USER
router.post("/edit/:id", (req, res) => {
  const { username, email, level } = req.body;
  const index = mockUsers.findIndex(u => u.id === parseInt(req.params.id));
  if (index !== -1) {
    mockUsers[index] = { ...mockUsers[index], username, email, level };
  }
  res.redirect("/users");
});

// DELETE USER
router.post("/delete/:id", (req, res) => {
  mockUsers = mockUsers.filter(u => u.id !== parseInt(req.params.id));
  res.redirect("/users");
});

module.exports = router;
