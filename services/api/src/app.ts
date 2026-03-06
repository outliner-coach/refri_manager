import Fastify from "fastify";
import multipart from "@fastify/multipart";
import sensible from "@fastify/sensible";
import cors from "@fastify/cors";
import { actorPlugin } from "./plugins/actor.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { internalRoutes } from "./routes/internal.js";
import { intakeRoutes } from "./routes/intake.js";
import { assetsRoutes } from "./routes/assets.js";
import { foodRoutes } from "./routes/foods.js";
import { slackRoutes } from "./routes/slack.js";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["content-type", "x-employee-no", "x-member-id"]
  });
  app.register(sensible);
  app.register(multipart, { limits: { fileSize: 8 * 1024 * 1024 } });
  app.addContentTypeParser(/^application\/x-www-form-urlencoded(?:;.*)?$/, { parseAs: "string" }, (_, body, done) => {
    done(null, body);
  });
  app.register(actorPlugin);

  app.get("/health", async () => ({ ok: true }));

  app.register(slackRoutes);
  app.register(authRoutes);
  app.register(adminRoutes);
  app.register(internalRoutes);
  app.register(intakeRoutes);
  app.register(assetsRoutes);
  app.register(foodRoutes);

  return app;
}
