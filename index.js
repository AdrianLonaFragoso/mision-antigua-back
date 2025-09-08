require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { Pool } = require("pg");
const { query } = require("./db/db");
const { getAllContacts, insertContact } = require("./db/queries");

const app = express();
const port = process.env.PORT || 3000;

// SMTP / Email configuration
const {
  SMTP_HOST = "mail.misionantigua.org",
  SMTP_PORT = "465",
  SMTP_SECURE = "true",
  SMTP_USER,
  SMTP_PASS,
  ADMIN_EMAIL = "administracion@misionantigua.org",
  FROM_NAME = "Misión Antigua",
  FROM_EMAIL,
} = process.env;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: SMTP_SECURE === "true" || Number(SMTP_PORT) === 465, // true for 465, false for others
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

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

// Database connection pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

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
  console.log("Received contact form submission:", {
    full_name,
    email,
    subject,
  });

  try {
    console.log("Attempting database insert...");
    const { rows } = await query(insertContact, [
      full_name,
      phone,
      email,
      subject,
      message,
    ]);
    console.log("Database insert successful:", rows[0]);

    // remitente real (SMTP_USER siempre)
    const fromAddress = `"${FROM_NAME}" <${SMTP_USER}>`;
    console.log("Preparing emails from:", fromAddress);

    // correo al usuario
    await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: `Hemos recibido tu mensaje: ${subject}`,
      text: `Hola ${full_name},\n\nGracias por contactarnos. Hemos recibido tu mensaje y pronto nos pondremos en contacto contigo.\n\nSaludos,\n${FROM_NAME}`,
      html: `<p>Hola <strong>${full_name}</strong>,</p>
             <p>Gracias por contactarnos. Hemos recibido tu mensaje y pronto nos pondremos en contacto contigo.</p>
             <p>Saludos,<br>${FROM_NAME}</p>`,
    });
    console.log("✅ Correo enviado al usuario");

    // correo al admin
    await transporter.sendMail({
      from: fromAddress,
      to: ADMIN_EMAIL,
      subject: `Nuevo mensaje de contacto: ${subject}`,
      replyTo: `${full_name} <${email}>`,
      text: `Nuevo mensaje recibido desde el formulario de contacto.\n\nNombre: ${full_name}\nEmail: ${email}\nTeléfono: ${phone}\n\nMensaje:\n${message}`,
      html: `<h3>Nuevo mensaje recibido desde el formulario de contacto</h3>
             <p><strong>Nombre:</strong> ${full_name}</p>
             <p><strong>Email:</strong> ${email}</p>
             <p><strong>Teléfono:</strong> ${phone}</p>
             <p><strong>Mensaje:</strong><br>${message}</p>`,
    });
    console.log("✅ Correo enviado al admin");

    res.status(201).json({
      ...rows[0],
      email_status: "sent",
    });
  } catch (err) {
    console.error("❌ Error en contact form:");
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);
    res.status(500).json({
      error:
        "Error al procesar tu mensaje. Por favor intenta de nuevo más tarde.",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

app.post("/api/test-email", async (req, res) => {
  const { to, subject, message } = req.body;

  if (!to) {
    return res.status(400).json({ error: "El campo 'to' es requerido" });
  }

  try {
    const fromAddress = `${FROM_NAME} <${FROM_EMAIL || SMTP_USER}>`;

    const testMail = {
      from: fromAddress,
      to,
      subject: subject || "Correo de prueba",
      text: message || "Este es un correo de prueba enviado desde Nodemailer.",
      html: `<p>${
        message ||
        "Este es un correo de prueba enviado desde <strong>Nodemailer</strong> 🚀"
      }</p>`,
    };

    const info = await transporter.sendMail(testMail);

    res.json({
      success: true,
      message: "Correo de prueba enviado correctamente",
      info,
    });
  } catch (err) {
    console.error("Error enviando correo de prueba:", err);
    res.status(500).json({ error: "No se pudo enviar el correo de prueba" });
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
