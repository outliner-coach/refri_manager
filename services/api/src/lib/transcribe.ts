import OpenAI from "openai";

export type FoodExtractedFields = {
  foodName: string | null;
  expiryDate: string | null;
  confidence: number;
  validationErrors: string[];
};

export type IdentityExtractedFields = {
  nameCandidate: string | null;
  confidence: number;
  validationErrors: string[];
};

const foodExtractionSchema = {
  name: "food_intake_extraction",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      foodName: { type: ["string", "null"] },
      expiryDate: {
        type: ["string", "null"],
        description: "YYYY-MM-DD format"
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1
      },
      validationErrors: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ["foodName", "expiryDate", "confidence", "validationErrors"]
  },
  strict: true
};

const identityExtractionSchema = {
  name: "identity_name_extraction",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      nameCandidate: { type: ["string", "null"] },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1
      },
      validationErrors: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ["nameCandidate", "confidence", "validationErrors"]
  },
  strict: true
};

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function transcribeAudio(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const client = getClient();

  const file = await OpenAI.toFile(buffer, filename, { type: mimeType });
  const result = await client.audio.transcriptions.create({
    file,
    model: "gpt-4o-transcribe"
  });

  return result.text;
}

export async function extractFoodFieldsFromTranscript(transcript: string): Promise<FoodExtractedFields> {
  const client = getClient();

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "Extract foodName and expiryDate from Korean transcript. expiryDate must be YYYY-MM-DD when possible. If uncertain, add validationErrors."
      },
      {
        role: "user",
        content: transcript
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: foodExtractionSchema.name,
        schema: foodExtractionSchema.schema,
        strict: true
      }
    }
  });

  const output = response.output_text;
  const parsed = JSON.parse(output) as FoodExtractedFields;
  return parsed;
}

export async function extractIdentityNameFromTranscript(
  transcript: string
): Promise<IdentityExtractedFields> {
  const client = getClient();

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "Extract only the person's Korean name from the transcript. Return null if unclear or missing. If uncertain, add validationErrors."
      },
      {
        role: "user",
        content: transcript
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: identityExtractionSchema.name,
        schema: identityExtractionSchema.schema,
        strict: true
      }
    }
  });

  const output = response.output_text;
  const parsed = JSON.parse(output) as IdentityExtractedFields;
  return parsed;
}
