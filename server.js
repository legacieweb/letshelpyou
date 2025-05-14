const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
require('dotenv').config(); // Load .env if you're using one
const JWT_SECRET = '7Switched';
const ADMIN_PASSWORD = '7Switched'; // secure in env for real use

const app = express();
const server = http.createServer(app);

// === Socket.IO Setup ===
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// === Middleware ===
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// === MongoDB Connection ===
const MONGODB_URI = 'mongodb+srv://legacieweb:aPX4XHXm7Ye5aUro@iyonicweb.cgaik.mongodb.net/?retryWrites=true&w=majority&appName=iyonicweb';

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB Atlas connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// === Mongoose Schema & Model ===
const ticketSchema = new mongoose.Schema({
  name: String,
  email: String,
  issue: String,
  service: String,
  contacted: { type: Boolean, default: false }
}, { timestamps: true });

const Ticket = mongoose.model('Ticket', ticketSchema);

// === Nodemailer Transport ===
// Replace with real Gmail/app password or environment variables
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'iyonicorp@gmail.com',
    pass: 'dikfirjarvijwskx'
  }
});

// === API Routes ===
app.post('/api/tickets', async (req, res) => {
  try {
    const ticket = new Ticket(req.body);
    await ticket.save();

    const { name, email, service, issue } = ticket;

    // 📤 Email to user
    const userMail = {
      from: 'iyonicorp@gmail.com',
      to: email,
      subject: '📨 Your Iyonicorp Ticket Confirmation',
      html: `
        <h2>Hello ${name},</h2>
        <p>We've received your ticket for <strong>${service}</strong>.</p>
        <p><strong>Issue:</strong> ${issue}</p>
        <p>You'll be contacted within 10 minutes.</p>
          <p>please turn on the ringtone for the calls</p>
        <br><p>— Iyonicorp Support</p>
      `
    };

    // 📥 Email to admin
    const adminMail = {
      from: 'iyonicorp@gmail.com',
      to: 'iyonicorp@gmail.com',
      subject: `🔔 New Support Ticket from ${name}`,
      html: `
        <h3>New Ticket Submitted</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Service:</strong> ${service}</p>
        <p><strong>Issue:</strong> ${issue}</p>
        <p><em>Time: ${new Date().toLocaleString()}</em></p>
      `
    };

    await transporter.sendMail(userMail);
    await transporter.sendMail(adminMail);

    res.json({ message: 'Ticket submitted and emails sent!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error saving ticket or sending email.' });
  }
});

app.get('/api/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching tickets.' });
  }
});

app.put('/api/tickets/:id/contacted', async (req, res) => {
  try {
    await Ticket.findByIdAndUpdate(req.params.id, { contacted: true });
    res.json({ message: 'Marked as contacted.' });
  } catch (err) {
    res.status(500).json({ message: 'Error updating ticket.' });
  }
});

// === WebRTC Signaling via Socket.IO ===
io.on('connection', (socket) => {
  console.log('✅ New socket connected:', socket.id);

  socket.on('join', (room) => {
    socket.join(room);
    console.log(`📥 Socket ${socket.id} joined room: ${room}`);
    socket.to(room).emit('peer-joined', socket.id);
  });

  socket.on('signal', ({ room, data }) => {
    console.log(`📡 Signal from ${socket.id} to room ${room}:`, {
      type: data?.type,
      callType: data?.callType
    });

    socket.to(room).emit('signal', {
      sender: socket.id,
      data
    });
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.id);
  });
});
// Login route
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token });
  }
  return res.status(401).json({ message: 'Invalid password' });
});

// Token verification route
app.get('/api/admin/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true });
  } catch (err) {
    res.status(403).json({ message: 'Invalid token' });
  }
});



// === Start Server ===
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
