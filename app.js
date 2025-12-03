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
    const result = await pool.query(
      "SELECT id, username, password, level FROM app_user WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.send("Invalid username or password");
    }

    const user = result.rows[0];

    // TODO: Replace this with bcrypt later
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

// ---------------------------------------------
// FEATURE ROUTES
// ---------------------------------------------
app.use("/participants", participantRoutes);
app.use("/events", eventRoutes);
app.use("/surveys", surveyRoutes);
app.use("/milestones", milestoneRoutes);
app.use("/donations", donationRoutes);
app.use("/", userRoutes);

// ---------------------------------------------
// START SERVER
// ---------------------------------------------
app.listen(port, () => {
  console.log(`Ella Rises app running at http://localhost:${port}`);
});
