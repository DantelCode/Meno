// ENVIRONMENT & DEPENDENCIES
require("dotenv").config();
const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const path = require("path");

// APPLICATION INITIALIZATION
const app = express();

// MIDDLEWARE CONFIGURATION
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "assets")));
app.use(express.static(path.join(__dirname, "public")));
app.use(expressLayouts);

// TEMPLATE ENGINE CONFIGURATION
app.set("layout", "layouts/main");
app.set("view engine", "ejs");

// ROUTE REGISTRATION
app.use("/", require("./routes/index"));

// SERVER INITIALIZATION
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║  ✅ MENO SERVER STARTED SUCCESSFULLY  ║
║  🌐 http://localhost:${PORT}${' '.repeat(14 - PORT.toString().length)}   ║
╚═══════════════════════════════════════╝
  `);
});