const express = require("express");
const { Pool } = require("pg");
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
    secret: "my-secret-key",
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
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "EllaRises", 
  password: "admin",
  port: 5432,
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
app.get("/", async (req, res) => {
  // Not logged in → Show public landing
  if (!req.session.user) {
    return res.render("publicLanding");
  }

  // Logged in → Show dashboard
  res.render("index");
});

// ---------------------------------------------
// AUTH ROUTES
// ---------------------------------------------
app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      "SELECT id, username, password, level FROM app_user WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.send("Invalid username or password");
    }

    const user = result.rows[0];

    if (user.password !== password) {
      return res.send("Invalid username or password");
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      level: user.level,
    };

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.send("Login error.");
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// ---------------------------------------------
// FEATURE ROUTES
// ---------------------------------------------
app.use("/participants", participantRoutes);
app.use("/events", eventRoutes);
app.use("/surveys", surveyRoutes);
app.use("/milestones", milestoneRoutes);
app.use("/donations", donationRoutes);
app.use("/", userRoutes); // general-purpose routes

// ---------------------------------------------
// START SERVER
// ---------------------------------------------
app.listen(port, () => {
  console.log(`Ella Rises app running at http://localhost:${port}`);
});
