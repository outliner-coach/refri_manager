import { FastifyInstance } from "fastify";
import {
  extractEmployeeLast4FromTranscript,
  extractFoodFieldsFromTranscript,
  extractIdentityNameFromTranscript,
  transcribeAudio
} from "../lib/transcribe.js";

type TranscribeIntent = "IDENTITY_NAME" | "FOOD_INFO" | "EMPLOYEE_LAST4";

function parseIntent(value: unknown): TranscribeIntent {
  if (value === "IDENTITY_NAME") {
    return "IDENTITY_NAME";
  }
  if (value === "EMPLOYEE_LAST4") {
    return "EMPLOYEE_LAST4";
  }
  return "FOOD_INFO";
}

export async function intakeRoutes(app: FastifyInstance) {
  app.post("/v1/intake/transcribe", async (request, reply) => {
    let audioBuffer: Buffer | null = null;
    let filename = "voice.webm";
    let mimeType = "audio/webm";
    let intent: TranscribeIntent = "FOOD_INFO";

    for await (const part of request.parts()) {
      if (part.type === "field" && part.fieldname === "intent") {
        intent = parseIntent(part.value);
      }

      if (part.type === "file" && part.fieldname === "audio") {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        audioBuffer = Buffer.concat(chunks);
        filename = part.filename || filename;
        mimeType = part.mimetype || mimeType;
      }
    }

    if (!audioBuffer) {
      return reply.badRequest("audio file is required");
    }

    const transcript = await transcribeAudio(audioBuffer, filename, mimeType);
    const extracted =
      intent === "IDENTITY_NAME"
        ? await extractIdentityNameFromTranscript(transcript)
        : intent === "EMPLOYEE_LAST4"
          ? await extractEmployeeLast4FromTranscript(transcript)
          : await extractFoodFieldsFromTranscript(transcript);

    return {
      transcript,
      intent,
      extracted,
      validationErrors: extracted.validationErrors
    };
  });
}
