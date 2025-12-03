require("dotenv").config();
const express = require("express");
const knex = require("knex");
const path = require("path");
const session = require("express-session");

const app = express();
const port = 3000;

// ---------------------------------------------
// Middleware
// ---------------------------------------------
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
// Database connection
// ---------------------------------------------
const db = knex({
  client: "pg",
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
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
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Using knex to query the database
    // Join app_user with participants to get role info
    const user = await db("app_user")
      .select(
        "app_user.user_id",
        "app_user.username",
        "app_user.password",
        "app_user.participant_id",
        "participants.participantrole",
        "participants.participantfirstname",
        "participants.participantlastname"
      )
      .leftJoin("participants", "app_user.participant_id", "participants.participantid")
      .where({ "app_user.username": username })
      .first();

    console.log("Login attempt:", { username, password });
    console.log("User found in DB:", user);

    if (!user) {
      return res.send("Invalid username or password (user not found)");
    }

    // TODO: Replace this with bcrypt later
    if (user.password !== password) {
      return res.send("Invalid username or password");
    }

    // Check participantrole to determine if admin or participant
    const isManager = user.participantrole === "admin";

    req.session.user = {
      id: user.user_id,
      username: user.username,
      level: isManager ? "M" : "U",
      participant_id: user.participant_id,
      firstName: user.participantfirstname,
      lastName: user.participantlastname
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
    const existingUser = await db("app_user").where({ username }).first();
    if (existingUser) {
      return res.render("register", { error: "Username already taken" });
    }

    // Check if email exists in participants table
    const participant = await db("participants")
      .where({ participantemail: email })
      .first();

    if (participant) {
      // Email found! Create user and link to existing participant
      const [newUser] = await db("app_user")
        .insert({
          username,
          password, // TODO: Hash with bcrypt
          participant_id: participant.participantid
        })
        .returning("*");

      // Log them in automatically
      const isManager = participant.participantrole === "admin";
      req.session.user = {
        id: newUser.user_id,
        username: newUser.username,
        level: isManager ? "M" : "U",
        participant_id: participant.participantid,
        firstName: participant.participantfirstname,
        lastName: participant.participantlastname
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
    participantfirstname, participantlastname, participantdob,
    participantphone, participantcity, participantstate, participantzip,
    participantschooloremployer, participantfieldofinterest
  } = req.body;

  try {
    // Create new participant record
    const [newParticipant] = await db("participants")
      .insert({
        participantemail: email,
        participantfirstname,
        participantlastname,
        participantdob: participantdob || null,
        participantphone,
        participantcity,
        participantstate,
        participantzip,
        participantschooloremployer,
        participantfieldofinterest,
        participantrole: "participant" // New users are regular participants
      })
      .returning("*");

    // Create user account linked to new participant
    const [newUser] = await db("app_user")
      .insert({
        username,
        password, // TODO: Hash with bcrypt
        participant_id: newParticipant.participantid
      })
      .returning("*");

    // Log them in automatically
    req.session.user = {
      id: newUser.user_id,
      username: newUser.username,
      level: "U", // New registrations are always regular users
      participant_id: newParticipant.participantid,
      firstName: newParticipant.participantfirstname,
      lastName: newParticipant.participantlastname
    };

    res.redirect("/");
  } catch (err) {
    console.error("Complete registration error:", err);
    res.render("register-details", {
      username, email, password,
      error: "Registration failed. Please try again."
    });
  }
});

// ---------------------------------------------
// DEV BYPASS (remove in production!)
// ---------------------------------------------
// Quick login as a regular user
app.get("/dev/user", (req, res) => {
  req.session.user = { id: 1, username: "testuser", level: "U" };
  res.redirect("/");
});

// Quick login as a manager
app.get("/dev/manager", (req, res) => {
  req.session.user = { id: 1, username: "testmanager", level: "M" };
  res.redirect("/");
});

// Test database connection
app.get("/dev/test-db", async (req, res) => {
  try {
    // Get current database name
    const dbInfo = await db.raw(`SELECT current_database(), current_schema()`);
    const currentDb = dbInfo.rows[0].current_database;
    const currentSchema = dbInfo.rows[0].current_schema;

    // List ALL schemas
    const schemas = await db.raw(`
      SELECT schema_name 
      FROM information_schema.schemata
    `);

    // List all tables in ALL schemas (not just public)
    const tables = await db.raw(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
    `);
    
    res.send(`
      <html>
      <head><link rel="stylesheet" href="/css/style.css"></head>
      <body style="padding: 40px; font-family: sans-serif;">
        <h1 style="color: green;">✅ Database Connected!</h1>
        <h3>Connection Info:</h3>
        <ul>
          <li><strong>Database:</strong> ${currentDb}</li>
          <li><strong>Current Schema:</strong> ${currentSchema}</li>
        </ul>
        <h3>All Schemas:</h3>
        <ul>
          ${schemas.rows.map(s => `<li>${s.schema_name}</li>`).join('')}
        </ul>
        <h3>Tables found (schema.table):</h3>
        <ul>
          ${tables.rows.map(t => `<li><a href="/dev/table/${t.table_name}">${t.table_schema}.${t.table_name}</a></li>`).join('')}
        </ul>
        <p><em>Click a table name to see its columns and data</em></p>
        <p><a href="/">← Back to Home</a></p>
      </body>
      </html>
    `);
  } catch (err) {
    res.send(`
      <html>
      <body style="padding: 40px; font-family: sans-serif;">
        <h1 style="color: red;">❌ Database Connection Failed</h1>
        <p><strong>Error:</strong> ${err.message}</p>
        <p>Check your .env file settings.</p>
      </body>
      </html>
    `);
  }
});

// View table details
app.get("/dev/table/:tableName", async (req, res) => {
  try {
    const tableName = req.params.tableName;
    
    // Get column info
    const columns = await db.raw(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = ?
    `, [tableName]);
    
    // Get first 10 rows of data
    const data = await db(tableName).limit(10);
    
    res.send(`
      <html>
      <head>
        <style>
          body { padding: 40px; font-family: sans-serif; }
          table { border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
          th { background: #f5f5f5; }
          .back { margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <p class="back"><a href="/dev/test-db">← Back to Tables</a></p>
        <h1>Table: ${tableName}</h1>
        
        <h3>Columns:</h3>
        <table>
          <tr><th>Column Name</th><th>Data Type</th></tr>
          ${columns.rows.map(c => `<tr><td>${c.column_name}</td><td>${c.data_type}</td></tr>`).join('')}
        </table>
        
        <h3>Sample Data (first 10 rows):</h3>
        ${data.length > 0 ? `
          <table>
            <tr>${Object.keys(data[0]).map(k => `<th>${k}</th>`).join('')}</tr>
            ${data.map(row => `<tr>${Object.values(row).map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}
          </table>
        ` : '<p>No data in this table yet.</p>'}
      </body>
      </html>
    `);
  } catch (err) {
    res.send(`<h1>Error</h1><p>${err.message}</p><a href="/dev/test-db">Back</a>`);
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
