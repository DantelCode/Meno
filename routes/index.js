// ========================================
// DEPENDENCIES
// ========================================
const express = require("express");
const router = express.Router();

// ========================================
// AUTHENTICATION MIDDLEWARE (FOR FUTURE USE)
// ========================================
// const { ensureAuthenticated } = require("../config/auth");
// router.use(ensureAuthenticated);

// Description: Root route - redirects to dashboard
router.get("/", (req, res) => {
  res.redirect("/dashboard");
});

// Description: Displays the main dashboard with daily overview and statistics
router.get("/dashboard", (req, res) => {
  res.render("tabs/dashboard", { title: "Meno — Dashboard" });
});

// Description: Displays the events calendar with event management features
router.get("/events", (req, res) => {
  res.render("tabs/events", { title: "Meno — Events Calendar" });
});

// Description: Displays the meal planner interface for meal scheduling
router.get("/meals", (req, res) => {
  res.render("tabs/meals", { title: "Meno — Meal Planner" });
});

// Description: Displays the shopping list management interface
router.get("/shopping", (req, res) => {
  res.render("tabs/shopping", { title: "Meno — Shopping List" });
});

// Description: Displays the support/feedback page for user assistance
router.get("/support", (req, res) => {
  res.render("tabs/support", { title: "Meno — Support" });
});

/**
 * Route: POST /support
 * Description: Handles support form submissions from users
 * 
 * @note: Current implementation accepts form data but does not persist it.
 *        Implement email notification or database storage as needed.
 * 
 * Future improvements:
 * - Add server-side validation and sanitization for form inputs
 * - Add server notifications/email for support submissions
 * - Add database storage and user authentication for persistent data
 */
router.post("/support", (req, res) => {
  // Extract form data from request body
  const name = req.body.name;
  const email = req.body.email;
  const message = req.body.message;

  // FUTURE: Add server-side validation and sanitization for form inputs
  if (!name || !email || !message) {
    return res.status(400).render("tabs/support", {
      title: "Meno — Support",
      error: "Please fill in all required fields"
    });
  }

  // FUTURE: Process support submission
  // - Send email notification to admin (SMTP/EmailJS server side)
  // - Store ticket in database (e.g., MongoDB/Postgres)
  // - Send confirmation email to user

  res.redirect("/support");
});

/**
 * Description: Fetches holidays and events from Google Calendar API
 *              Handles CORS and API key security on the backend
 */
router.get("/api/google-events", async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const timeMin = new Date(year, 0, 1).toISOString();
    const timeMax = new Date(year, 11, 31, 23, 59, 59).toISOString();
    
    const apiKey = process.env.API_KEY; // Your ApiKey from Google Calendar Api
    
    // Try to fetch from Google Calendar
    const calendarId = encodeURIComponent('en.NG#holiday@group.v.calendar.google.com');
    const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&maxResults=250&singleEvents=true&orderBy=startTime`;
    
    console.log(`Attempting to fetch Google Calendar events for (${year})`);
    let allEvents = [];
    
    try {
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        allEvents = data.items || [];
        console.log(`Successfully fetched ${allEvents.length} events from Google Calendar`);
      } else {
        console.warn(`Google Calendar API returned status ${response.status}, using fallback holidays`);
        allEvents = getHolidays(year);
      }
    } catch (err) {
      console.warn(`Google Calendar fetch failed (${err.message}), using fallback holidays`);
      allEvents = getHolidays(year);
    }
    
    res.json({ success: true, items: allEvents });
  } catch (error) {
    console.error("Google Calendar API Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Used as fallback when Google Calendar API is unavailable
 */
function getHolidays(year) {
  const holidays = [
    { summary: "New Year's Day", start: { date: `${year}-01-01` }, end: { date: `${year}-01-02` } },
    { summary: "Christmas Day", start: { date: `${year}-12-25` }, end: { date: `${year}-12-26` } },
    { summary: "Easter Monday", start: { date: `${year}-03-21` }, end: { date: `${year}-03-22` } } // Approximate
  ];
  return holidays;
}

// EXPORTS
module.exports = router;
