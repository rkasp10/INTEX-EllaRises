require("dotenv").config();
const express = require("express");
const path = require("path");
const session = require("express-session");
const helmet = require("helmet"); // Security middleware
const db = require("./db"); // Shared database connection

const app = express();
const port = 3000;

// ---------------------------------------------
// Middleware
// ---------------------------------------------
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for development (allows inline scripts/styles)
}));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// Make user accessible in EJS views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

// ---------------------------------------------
// Static files + View engine
// ---------------------------------------------
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");

// ---------------------------------------------
// Helper Functions
// ---------------------------------------------
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
}

function requireManager(req, res, next) {
  if (!req.session.user || req.session.user.level !== "M") {
    return res.status(403).send("Managers only.");
  }
  next();
}

// ---------------------------------------------
// ROUTE IMPORTS
// ---------------------------------------------
const participantRoutes = require("./routes/participants");
const eventRoutes = require("./routes/events");
const surveyRoutes = require("./routes/surveys");
const milestoneRoutes = require("./routes/milestones");
const donationRoutes = require("./routes/donations");
const userRoutes = require("./routes/users");

// ---------------------------------------------
// ROOT ROUTE (PUBLIC LANDING vs DASHBOARD)
// ---------------------------------------------
app.get("/", (req, res) => {
  if (!req.session.user) {
    return res.render("publicLanding");
  }
  res.render("index");
});

// ---------------------------------------------
// AUTH ROUTES
// ---------------------------------------------
app.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/");
  }
  res.render("login", { error: req.query.error });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Using knex to query the database
    // Join users with participants to get role info
    const user = await db("users")
      .select(
        "users.user_id",
        "users.username",
        "users.password",
        "users.participant_id",
        "participants.participant_role",
        "participants.participant_first_name",
        "participants.participant_last_name"
      )
      .leftJoin("participants", "users.participant_id", "participants.participant_id")
      .where({ "users.username": username })
      .first();

    console.log("Login attempt:", { username, password });
    console.log("User found in DB:", user);

    if (!user) {
      return res.redirect("/login?error=invalid");
    }

    // TODO: Replace this with bcrypt later
    if (user.password !== password) {
      return res.redirect("/login?error=invalid");
    }

    // Check participant_role to determine if admin or participant
    const isManager = user.participant_role === "admin";

    req.session.user = {
      id: user.user_id,
      username: user.username,
      level: isManager ? "M" : "U",
      participant_id: user.participant_id,
      firstName: user.participant_first_name,
      lastName: user.participant_last_name
    };

    console.log("Login successful, session set:", req.session.user);
    res.redirect("/");
  } catch (err) {
    console.error("Login error:", err);
    res.send("Login error: " + err.message);
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// ---------------------------------------------
// REGISTRATION ROUTES
// ---------------------------------------------
app.get("/register", (req, res) => {
  if (req.session.user) {
    return res.redirect("/");
  }
  res.render("register", { error: null });
});

app.post("/register", async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  // Validate passwords match
  if (password !== confirmPassword) {
    return res.render("register", { error: "Passwords do not match" });
  }

  try {
    // Check if username already exists
    const existingUser = await db("users").where({ username }).first();
    if (existingUser) {
      return res.render("register", { error: "Username already taken" });
    }

    // Check if email exists in participants table
    const participant = await db("participants")
      .where({ participant_email: email })
      .first();

    if (participant) {
      // Email found! Create user and link to existing participant
      const [newUser] = await db("users")
        .insert({
          username,
          password, // TODO: Hash with bcrypt
          participant_id: participant.participant_id
        })
        .returning("*");

      // Log them in automatically
      const isManager = participant.participant_role === "admin";
      req.session.user = {
        id: newUser.user_id,
        username: newUser.username,
        level: isManager ? "M" : "U",
        participant_id: participant.participant_id,
        firstName: participant.participant_first_name,
        lastName: participant.participant_last_name
      };

      return res.redirect("/");
    } else {
      // Email NOT found - need to collect participant details
      res.render("register-details", {
        username,
        email,
        password,
        error: null
      });
    }
  } catch (err) {
    console.error("Registration error:", err);
    res.render("register", { error: "Registration failed. Please try again." });
  }
});

// Complete registration (create new participant + user)
app.post("/register/complete", async (req, res) => {
  const {
    username, email, password,
    participant_first_name, participant_last_name, participant_dob,
    participant_phone, participant_city, participant_state, participant_zip,
    participant_school_or_employer, participant_field_of_interest
  } = req.body;

  try {
    // Create new participant record
    const [newParticipant] = await db("participants")
      .insert({
        participant_email: email,
        participant_first_name,
        participant_last_name,
        participant_dob: participant_dob || null,
        participant_phone,
        participant_city,
        participant_state,
        participant_zip,
        participant_school_or_employer,
        participant_field_of_interest,
        participant_role: "participant" // New users are regular participants
      })
      .returning("*");

    // Create user account linked to new participant
    const [newUser] = await db("users")
      .insert({
        username,
        password, // TODO: Hash with bcrypt
        participant_id: newParticipant.participant_id
      })
      .returning("*");

    // Log them in automatically
    req.session.user = {
      id: newUser.user_id,
      username: newUser.username,
      level: "U", // New registrations are always regular users
      participant_id: newParticipant.participant_id,
      firstName: newParticipant.participant_first_name,
      lastName: newParticipant.participant_last_name
    };

    res.redirect("/");
  } catch (err) {
    console.error("Complete registration error:", err);
    
    let errorMessage = "Registration failed. Please try again.";
    if (err.message && err.message.includes("value too long")) {
      errorMessage = "One of your entries is too long. Please shorten School/Employer and Field of Interest to 19 characters or less.";
    }
    
    res.render("register-details", {
      username, email, password,
      error: errorMessage
    });
  }
});

// ---------------------------------------------
// HTTP 418 - I'm a teapot (IS 404 requirement)
// ---------------------------------------------
app.get("/teapot", (req, res) => {
  res.status(418).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>418 - I'm a Teapot</title>
      <link rel="stylesheet" href="/css/style.css">
      <style>
        .teapot-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: linear-gradient(135deg, var(--pink-light) 0%, var(--cream) 100%);
          text-align: center;
          padding: 20px;
        }
        .teapot-icon {
          font-size: 8rem;
          margin-bottom: 20px;
        }
        .teapot-title {
          font-family: var(--font-display);
          font-size: 3rem;
          color: var(--green-dark);
          margin: 0 0 10px 0;
        }
        .teapot-code {
          font-size: 1.2rem;
          color: #888;
          margin-bottom: 20px;
        }
        .teapot-message {
          font-size: 1.1rem;
          color: #666;
          max-width: 400px;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .teapot-link {
          display: inline-block;
          padding: 12px 30px;
          background-color: var(--sage);
          color: white;
          text-decoration: none;
          border-radius: 25px;
          font-weight: 600;
          transition: background-color 0.2s;
        }
        .teapot-link:hover {
          background-color: var(--green-dark);
        }
      </style>
    </head>
    <body>
      <div class="teapot-container">
        <div class="teapot-icon">🫖</div>
        <h1 class="teapot-title">I'm a Teapot</h1>
        <p class="teapot-code">HTTP 418</p>
        <p class="teapot-message">
          The server refuses to brew coffee because it is, permanently, a teapot. 
          This error is a reference to Hyper Text Coffee Pot Control Protocol defined in RFC 2324.
        </p>
        <a href="/" class="teapot-link">Return Home</a>
      </div>
    </body>
    </html>
  `);
});

// ---------------------------------------------
// PUBLIC DONATION ROUTES (no login required)
// ---------------------------------------------
app.get("/donations/donate", (req, res) => {
  res.render("donations/donate");
});

app.post("/donations/donate", async (req, res) => {
  try {
    const { donor_name, donor_email, donation_amount } = req.body;

    // Try to find participant by email if provided
    let participantId = null;
    let donorDisplayName = donor_name || "Anonymous";

    if (donor_email) {
      const participant = await db("participants")
        .select("participant_id", "participant_first_name", "participant_last_name")
        .where("participant_email", donor_email.toLowerCase().trim())
        .first();
      
      if (participant) {
        participantId = participant.participant_id;
        donorDisplayName = `${participant.participant_first_name} ${participant.participant_last_name}`;
      }
    }

    await db("donations").insert({
      participant_id: participantId,
      donation_amount: parseFloat(donation_amount),
      donation_date: new Date()
    });

    const linkedMessage = participantId 
      ? `<p style="color: var(--sage); font-weight: 500;">✓ Donation linked to your Ella Rises account!</p>`
      : "";

    res.send(`
      <html>
      <head><link rel="stylesheet" href="/css/style.css"></head>
      <body class="landing-body" style="display:flex; justify-content:center; align-items:center; min-height:100vh;">
        <div style="text-align:center; background: var(--pink-light); padding: 40px; border-radius: 20px; max-width: 500px;">
          <h1 style="color: var(--green-dark); font-family: var(--font-display);">Thank You, ${donorDisplayName}!</h1>
          <p>Thank you for your generous donation of $${parseFloat(donation_amount).toFixed(2)}.</p>
          ${linkedMessage}
          <p>Your support helps us empower young women through STEAM education.</p>
          <a href="/" style="display:inline-block; margin-top:20px; padding:12px 30px; background:var(--green-soft); color:white; text-decoration:none; border-radius:20px;">Return Home</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("Error processing donation:", err);
    res.send("Error processing donation: " + err.message);
  }
});

// ---------------------------------------------
// FEATURE ROUTES (protected - require login)
// ---------------------------------------------
app.use("/participants", requireLogin, participantRoutes);
app.use("/events", requireLogin, eventRoutes);
app.use("/surveys", requireLogin, surveyRoutes);
app.use("/milestones", requireLogin, milestoneRoutes);
app.use("/donations", requireLogin, donationRoutes);
app.use("/users", requireLogin, requireManager, userRoutes);

// ---------------------------------------------
// START SERVER
// ---------------------------------------------
app.listen(port, () => {
  console.log(`Ella Rises app running at http://localhost:${port}`);
});
