require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const cors = require("cors");
const { query } = require("./db/db");
const { getAllContacts, insertContact } = require("./db/queries");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Input validation middleware
const validateContactInput = (req, res, next) => {
  const { full_name, phone, email, subject, message } = req.body;

  // Basic validation
  if (!full_name || !phone || !email || !subject || !message) {
    return res.status(400).json({ error: "All fields are required" });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  // Phone validation (basic)
  const phoneRegex = /^[0-9\-\+]{9,15}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ error: "Invalid phone number format" });
  }

  // Sanitize inputs (basic example)
  req.body.full_name = full_name.toString().trim().substring(0, 100);
  req.body.phone = phone.toString().trim().substring(0, 20);
  req.body.email = email.toString().trim().toLowerCase().substring(0, 100);
  req.body.subject = subject.toString().trim().substring(0, 100);
  req.body.message = message.toString().trim().substring(0, 5000);

  next();
};

// Routes
app.get("/api/contacts", async (req, res) => {
  try {
    const { rows } = await query(getAllContacts);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching contacts:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/contacts", validateContactInput, async (req, res) => {
  const { full_name, phone, email, subject, message } = req.body;

  try {
    const { rows } = await query(insertContact, [
      full_name,
      phone,
      email,
      subject,
      message,
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error saving contact:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
