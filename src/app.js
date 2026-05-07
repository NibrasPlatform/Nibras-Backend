const express = require("express");
const cors = require("cors");

const apiRoutes = require("./routes");
const notFoundMiddleware = require("./core/middlewares/notFound.middleware");
const errorMiddleware = require("./core/middlewares/error.middleware");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Nibras modular monolith API is running.",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, status: "ok" });
});

app.get("/ready", (req, res) => {
  res.status(200).json({ success: true, status: "ready" });
});

app.use("/api", apiRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
