import "dotenv/config";
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { connectDB } from "./src/config/db.js";
import { auth } from "./src/lib/auth.js";
import { requireAuth, requireRole } from "./src/middleware/auth.js";
import adminRoutes from "./src/routes/admin.js";
import { adminDoctorRoutes, doctorRoutes } from "./src/routes/doctors.js";
import { beds, labRooms, labTests } from "./src/routes/masterData.js";
import {
  searchRoutes,
  adminRoutes as adminMedicineRoutes,
} from "./src/routes/medicines.js";
import { ensureMedicineIndexes } from "./src/lib/medicines.js";

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("BZM HMS server running");
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json(req.user);
});

app.get(
  "/api/admin/test",
  requireAuth,
  requireRole("superadmin"),
  (req, res) => {
    res.json({ message: "Super Admin access OK" });
  },
);

app.use("/api/admin/doctors", adminDoctorRoutes);
app.use("/api/doctors", doctorRoutes);

app.use("/api/admin/beds", beds.admin);
app.use("/api/beds", beds.read);
app.use("/api/admin/lab-rooms", labRooms.admin);
app.use("/api/lab-rooms", labRooms.read);
app.use("/api/admin/lab-tests", labTests.admin);
app.use("/api/lab-tests", labTests.read);

app.use("/api/admin", adminRoutes);
app.use("/api/admin/medicines", adminMedicineRoutes);
app.use("/api/medicines", searchRoutes);

connectDB()
  .then(ensureMedicineIndexes)
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
