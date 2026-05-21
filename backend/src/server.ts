import dotenv from "dotenv";

dotenv.config();

import app from "./app";

import reportRoutes from "./routes/report.routes";

const PORT =
  process.env.PORT || 5000;

/* REPORT ROUTES */
app.use(
  "/reports",
  reportRoutes
);

app.listen(PORT, () => {

  console.log(
    `Server running on port ${PORT}`
  );

});