require("dotenv").config()
const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const nodemailer = require("nodemailer")

const app = express()

// ---------- CONFIG ----------
const PORT = process.env.PORT || 5000
const OWNER_EMAIL = process.env.OWNER_EMAIL

// ---------- MIDDLEWARE ----------
app.use(helmet())

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN,
    methods: ["POST", "GET"],
  })
)

app.use(express.json({ limit: "10kb" }))

// ---------- HEALTH CHECK ----------
app.get("/health", (req, res) => {
  res.json({ ok: true })
})

// ---------- RATE LIMIT ----------
app.use(
  "/api/contact",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
  })
)

// ---------- HELPERS ----------
const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))

// ---------- MAIL SETUP ----------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false, // local dev fix
  },
})

transporter.verify().then(
  () => console.log("✅ SMTP ready"),
  (err) => console.log("❌ SMTP error:", err.message)
)

// ---------- CONTACT API ----------
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, phone, service, message } = req.body

    if (!name || !email || !service || !message) {
      return res.status(400).json({ error: "Required fields missing" })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Invalid email" })
    }

    // OWNER MAIL
    await transporter.sendMail({
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: OWNER_EMAIL,
      replyTo: email,
      subject: `New Contact: ${name}`,
      html: `
        <h3>New Contact Request</h3>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone || "-"}</p>
        <p><b>Service:</b> ${service}</p>
        <p><b>Message:</b> ${message}</p>
      `,
    })

    // USER MAIL
    await transporter.sendMail({
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: "We received your request",
      html: `
        <p>Hi ${name},</p>
        <p>Thanks for contacting us. We’ll get back to you soon.</p>
        <p>— ${process.env.FROM_NAME}</p>
      `,
    })

    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Server error" })
  }
})

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`)
})
