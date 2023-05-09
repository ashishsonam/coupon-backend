if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const cors = require("cors");
const healthcheck = require("./routes/api");
const coupon = require("./routes/coupon");
const user = require("./routes/user");

const app = express();
const http = require("http");
const server = http.createServer(app);

app.use(bodyParser.json({ type: "application/vnd.api+json" }));
app.use(helmet());
app.use(
  cors({
    allowedHeaders: [
      "Content-Type",
      "token",
      "authorization",
      "*",
      "Content-Length",
      "X-Requested-With",
    ],
    origin: "*",
    preflightContinue: true,
  })
);
app.use(express.json({ limit: "1024mb" }));
app.use(express.urlencoded({ limit: "1024mb", extended: true }));
const PORT = process.env.PORT || 5000;

app.use("/api", healthcheck);
app.use("/api/coupon", coupon);
app.use("/api/user", user);

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
