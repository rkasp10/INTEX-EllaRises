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

// Note: This route is already protected by requireManager in app.js

// ============================================
// USERS LIST (Manager only)
// ============================================
router.get("/", async (req, res) => {
  try {
    const users = await db("users")
      .select(
        "users.*",
        "participants.participant_first_name",
        "participants.participant_last_name",
        "participants.participant_email",
        "participants.participant_role"
      )
      .leftJoin("participants", "users.participant_id", "participants.participant_id")
      .orderBy("users.username");

    res.render("users/index", { users });
  } catch (err) {
    console.error("Error loading users:", err);
    res.send("Error loading users: " + err.message);
  }
});

// ============================================
// ADD USER FORM
// ============================================
router.get("/add", async (req, res) => {
  try {
    // Get participants that don't have user accounts yet
    const participants = await db("participants")
      .select("participant_id", "participant_first_name", "participant_last_name", "participant_email")
      .whereNotIn("participant_id", db("users").select("participant_id").whereNotNull("participant_id"))
      .orderBy("participant_last_name");

    res.render("users/add", { participants });
  } catch (err) {
    console.error(err);
    res.render("users/add", { participants: [] });
  }
});

// ============================================
// CREATE USER
// ============================================
router.post("/add", async (req, res) => {
  try {
    const { username, password, participant_id } = req.body;

    // TODO: Hash password with bcrypt
    await db("users").insert({
      username,
      password,
      participant_id: participant_id ? parseInt(participant_id) : null
    });

    res.redirect("/users");
  } catch (err) {
    console.error("Error adding user:", err);
    res.send("Error adding user: " + err.message);
  }
});

// ============================================
// EDIT USER FORM
// ============================================
router.get("/edit/:id", async (req, res) => {
  try {
    const user = await db("users")
      .where({ user_id: req.params.id })
      .first();

    const participants = await db("participants")
      .select("participant_id", "participant_first_name", "participant_last_name", "participant_email")
      .orderBy("participant_last_name");

    if (!user) return res.status(404).send("User not found");
    res.render("users/edit", { user, participants });
  } catch (err) {
    console.error(err);
    res.send("Error loading user");
  }
});

// ============================================
// UPDATE USER
// ============================================
router.post("/edit/:id", async (req, res) => {
  try {
    const { username, password, participant_id } = req.body;

    const updateData = {
      username,
      participant_id: participant_id ? parseInt(participant_id) : null
    };

    // Only update password if a new one was provided
    if (password && password.trim() !== "") {
      // TODO: Hash password with bcrypt
      updateData.password = password;
    }

    await db("users")
      .where({ user_id: req.params.id })
      .update(updateData);

    res.redirect("/users");
  } catch (err) {
    console.error("Error updating user:", err);
    res.send("Error updating user: " + err.message);
  }
});

// ============================================
// DELETE USER
// ============================================
router.post("/delete/:id", async (req, res) => {
  try {
    // Prevent deleting yourself
    if (parseInt(req.params.id) === req.session.user.id) {
      return res.status(400).send("Cannot delete your own account");
    }

    await db("users").where({ user_id: req.params.id }).del();
    res.redirect("/users");
  } catch (err) {
    console.error("Error deleting user:", err);
    res.send("Error deleting user: " + err.message);
  }
});

module.exports = router;
