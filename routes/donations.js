const express = require("express");
const router = express.Router();

// ============================================
// MOCK DATA
// ============================================
let mockDonations = [
  { id: 1, donor_name: "John Smith", email: "john@example.com", amount: 100.00, message: "Keep up the great work!", date: "2024-11-01" },
  { id: 2, donor_name: "Maria Garcia", email: "maria@example.com", amount: 250.00, message: "Supporting our community's future leaders!", date: "2024-11-05" },
  { id: 3, donor_name: "Anonymous", email: "anon@example.com", amount: 50.00, message: "", date: "2024-11-10" },
  { id: 4, donor_name: "Tech Corp", email: "giving@techcorp.com", amount: 1000.00, message: "Proud sponsor of STEAM education", date: "2024-11-15" },
  { id: 5, donor_name: "Sarah Johnson", email: "sarah@example.com", amount: 75.00, message: "For the girls!", date: "2024-11-20" },
];

function isManager(req) {
  return req.session.user && req.session.user.level === "M";
}

// ============================================
// PUBLIC DONATION FORM (no login required)
// ============================================
router.get("/donate", (req, res) => {
  res.render("donations/donate");
});

router.post("/donate", async (req, res) => {
  const { donor_name, email, amount, message } = req.body;
  
  // Add to mock data (TODO: Save to database)
  mockDonations.push({
    id: mockDonations.length + 1,
    donor_name, email, 
    amount: parseFloat(amount),
    message: message || "",
    date: new Date().toISOString().split("T")[0]
  });
  
  res.send(`
    <html>
    <head><link rel="stylesheet" href="/css/style.css"></head>
    <body class="landing-body" style="display:flex; justify-content:center; align-items:center; min-height:100vh;">
      <div style="text-align:center; background: var(--pink-light); padding: 40px; border-radius: 20px; max-width: 500px;">
        <h1 style="color: var(--green-dark); font-family: var(--font-display);">Thank You!</h1>
        <p>Thank you, ${donor_name}, for your generous donation of $${amount}.</p>
        <p>Your support helps us empower young women through STEAM education.</p>
        <a href="/" style="display:inline-block; margin-top:20px; padding:12px 30px; background:var(--green-soft); color:white; text-decoration:none; border-radius:20px;">Return Home</a>
      </div>
    </body>
    </html>
  `);
});

// ============================================
// DONATIONS LIST (Manager only - protected in app.js)
// ============================================
router.get("/", (req, res) => {
  if (!isManager(req)) {
    return res.status(403).send("Access denied. Managers only.");
  }
  
  const totalDonations = mockDonations.reduce((sum, d) => sum + d.amount, 0);
  res.render("donations/index", { 
    donations: mockDonations,
    totalDonations,
    isManager: true 
  });
});

// DELETE DONATION (Manager)
router.post("/delete/:id", (req, res) => {
  if (!isManager(req)) return res.status(403).send("Access denied.");
  mockDonations = mockDonations.filter(d => d.id !== parseInt(req.params.id));
  res.redirect("/donations");
});

module.exports = router;
