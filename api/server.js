require("dotenv").config();
const express = require("express");
const serverless = require("serverless-http");
const expressLayouts = require("express-ejs-layouts");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "..", "assets")));
app.use(express.static(path.join(__dirname, "..", "public")));

app.use(expressLayouts);
app.set("layout", "layouts/main");
app.set("view engine", "ejs");

app.use("/", require("../routes/index"));

module.exports = serverless(app);
