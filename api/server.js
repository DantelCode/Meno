// ENVIRONMENT & DEPENDENCIES
require("dotenv").config();

const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const path = require("path");

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
app.set("views", path.join(__dirname, "views"));

// ROUTE REGISTRATION
const indexRoutes = require("./routes/index");
app.use("/", indexRoutes);

/*
// UNCOMMENT THIS TESTING PURPOSE
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    MENO SERVER SUCCESSFULLY STARTED AT PORT ${PORT}
    `)
})  
*/

// ❌ DO NOT LISTEN ON A PORT (Vercel handles this)
module.exports = app;
