// This file houses all of the routes for the users views.


const express = require("express");
const router = express.Router();
const db = require("../db"); // Shared database connection

// Note: This route is already protected by requireManager in app.js

// ============================================
// USERS LIST (Manager only)
// ============================================
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || "";
    const limit = 12;
    const offset = (page - 1) * limit;

    let query = db("users")
      .select(
        "users.*",
        "participants.participant_first_name",
        "participants.participant_last_name",
        "participants.participant_email",
        "participants.participant_role"
      )
      .leftJoin("participants", "users.participant_id", "participants.participant_id");
    
    let countQuery = db("users")
      .leftJoin("participants", "users.participant_id", "participants.participant_id");

    if (search) {
      const searchPattern = `%${search}%`;
      query = query.where(function() {
        this.whereRaw("LOWER(users.username) LIKE LOWER(?)", [searchPattern])
          .orWhereRaw("LOWER(participants.participant_first_name) LIKE LOWER(?)", [searchPattern])
          .orWhereRaw("LOWER(participants.participant_last_name) LIKE LOWER(?)", [searchPattern])
          .orWhereRaw("LOWER(participants.participant_email) LIKE LOWER(?)", [searchPattern]);
      });
      countQuery = countQuery.where(function() {
        this.whereRaw("LOWER(users.username) LIKE LOWER(?)", [searchPattern])
          .orWhereRaw("LOWER(participants.participant_first_name) LIKE LOWER(?)", [searchPattern])
          .orWhereRaw("LOWER(participants.participant_last_name) LIKE LOWER(?)", [searchPattern])
          .orWhereRaw("LOWER(participants.participant_email) LIKE LOWER(?)", [searchPattern]);
      });
    }

    const [{ count }] = await countQuery.count("users.user_id as count");
    const totalPages = Math.ceil(count / limit);

    const users = await query
      .orderBy("users.username")
      .limit(limit)
      .offset(offset);

    res.render("users/index", { 
      users,
      currentPage: page,
      totalPages,
      totalItems: parseInt(count),
      search
    });
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
    const { 
      username, 
      password, 
      participant_id,
      // New participant fields
      participant_first_name,
      participant_last_name,
      participant_email,
      participant_dob,
      participant_phone,
      participant_city,
      participant_state,
      participant_zip,
      participant_school_or_employer,
      participant_field_of_interest,
      participant_role
    } = req.body;

    let finalParticipantId = null;

    // If "new" is selected, create a new participant first
    if (participant_id === 'new') {
      // Validate required fields
      if (!participant_first_name || !participant_last_name || !participant_email) {
        return res.send("Error: First name, last name, and email are required for new participants");
      }

      // Insert new participant and get the ID
      const [newParticipant] = await db("participants")
        .insert({
          participant_first_name,
          participant_last_name,
          participant_email,
          participant_dob: participant_dob || null,
          participant_phone: participant_phone || null,
          participant_city: participant_city || null,
          participant_state: participant_state || null,
          participant_zip: participant_zip || null,
          participant_school_or_employer: participant_school_or_employer || null,
          participant_field_of_interest: participant_field_of_interest || null,
          participant_role: participant_role || 'participant'
        })
        .returning("participant_id");

      finalParticipantId = newParticipant.participant_id || newParticipant;
    } else if (participant_id) {
      finalParticipantId = parseInt(participant_id);
    }

    // TODO: Hash password with bcrypt
    await db("users").insert({
      username,
      password,
      participant_id: finalParticipantId
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
      .select("users.*", "participants.participant_role")
      .leftJoin("participants", "users.participant_id", "participants.participant_id")
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
    const { username, password, participant_id, participant_role } = req.body;

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

    // Update participant role if there's a linked participant
    if (participant_id) {
      await db("participants")
        .where({ participant_id: parseInt(participant_id) })
        .update({ participant_role: participant_role || 'participant' });
    }

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
