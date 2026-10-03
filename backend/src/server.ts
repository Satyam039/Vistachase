import "dotenv/config";
import { createApp } from "@/app";

const port = parseInt(process.env.PORT || "4000", 10);

createApp().listen(port, () => {
  console.log(`[vistachase-backend] API listening on http://localhost:${port}`);
});
