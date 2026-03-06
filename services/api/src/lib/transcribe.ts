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

export type EmployeeLast4ExtractedFields = {
  employeeNoLast4: string | null;
  confidence: number;
  validationErrors: string[];
};

export type ConfirmationExtractedFields = {
  confirmed: boolean | null;
  confidence: number;
  validationErrors: string[];
};

export type SelectionNumberExtractedFields = {
  selectedNumber: number | null;
  confidence: number;
  validationErrors: string[];
};

export type TranscribeIntent =
  | "IDENTITY_NAME"
  | "FOOD_INFO"
  | "EMPLOYEE_LAST4"
  | "CONFIRMATION"
  | "SELECTION_NUMBER";

type TranscriptionModel = "gpt-4o-transcribe" | "gpt-4o-mini-transcribe" | "whisper-1";

const DEFAULT_TRANSCRIPTION_MODEL: TranscriptionModel = "gpt-4o-transcribe";
const DEFAULT_TRANSCRIPTION_LANGUAGE = "ko";
const DEFAULT_TRANSCRIPTION_PROMPT =
  "Transcribe Korean speech in Korean only. Do not translate. Keep names, food names, and numbers exactly as spoken.";

const confirmationKeywords = {
  positive: ["네", "예", "응", "맞아", "맞아요", "맞습니다", "확인", "좋아요", "진행", "등록해"],
  negative: ["아니", "아니요", "틀려", "수정", "다시", "취소", "아냐"]
} as const;

const spokenNumberPatterns: Array<{ value: number; patterns: string[] }> = [
  { value: 1, patterns: ["1번", "1", "한번", "하나", "일번", "일", "첫번째", "첫째", "첫"] },
  { value: 2, patterns: ["2번", "2", "두번", "둘", "이번", "이", "두번째", "둘째", "두"] },
  { value: 3, patterns: ["3번", "3", "세번", "셋", "삼번", "삼", "세번째", "셋째", "세"] },
  { value: 4, patterns: ["4번", "4", "네번", "넷", "사번", "사", "네번째", "넷째", "네"] },
  { value: 5, patterns: ["5번", "5", "다섯", "오번", "오", "다섯번째"] },
  { value: 6, patterns: ["6번", "6", "여섯", "육번", "육", "여섯번째"] },
  { value: 7, patterns: ["7번", "7", "일곱", "칠번", "칠", "일곱번째"] },
  { value: 8, patterns: ["8번", "8", "여덟", "팔번", "팔", "여덟번째"] },
  { value: 9, patterns: ["9번", "9", "아홉", "구번", "구", "아홉번째"] }
];

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

const employeeLast4ExtractionSchema = {
  name: "employee_last4_extraction",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      employeeNoLast4: {
        type: ["string", "null"],
        description: "4-digit employee number suffix when present, ex: 1234"
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
    required: ["employeeNoLast4", "confidence", "validationErrors"]
  },
  strict: true
};

const transcriptionIntentInstructions: Record<TranscribeIntent, string> = {
  IDENTITY_NAME: "The utterance is expected to contain a Korean person's name.",
  FOOD_INFO:
    "The utterance is expected to contain a food name and an expiration date. Preserve spoken dates and numbers.",
  EMPLOYEE_LAST4:
    "The utterance is expected to contain the last four digits of an employee number. Preserve each digit exactly.",
  CONFIRMATION: "The utterance is expected to be a short yes or no confirmation in Korean.",
  SELECTION_NUMBER: "The utterance is expected to contain a selected list number in Korean. Preserve the spoken number."
};

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getTranscriptionModel(): TranscriptionModel {
  const value = process.env.OPENAI_TRANSCRIPTION_MODEL;
  if (value === "gpt-4o-mini-transcribe" || value === "whisper-1") {
    return value;
  }
  return DEFAULT_TRANSCRIPTION_MODEL;
}

function getTranscriptionLanguage(): string {
  return process.env.OPENAI_TRANSCRIPTION_LANGUAGE?.trim() || DEFAULT_TRANSCRIPTION_LANGUAGE;
}

function getTranscriptionBasePrompt(): string {
  return process.env.OPENAI_TRANSCRIPTION_PROMPT?.trim() || DEFAULT_TRANSCRIPTION_PROMPT;
}

export function buildTranscriptionPrompt(intent: TranscribeIntent): string {
  return `${getTranscriptionBasePrompt()} ${transcriptionIntentInstructions[intent]}`.trim();
}

export async function transcribeAudio(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  intent: TranscribeIntent
): Promise<string> {
  const client = getClient();

  const file = await OpenAI.toFile(buffer, filename, { type: mimeType });
  const result = await client.audio.transcriptions.create({
    file,
    model: getTranscriptionModel(),
    language: getTranscriptionLanguage(),
    prompt: buildTranscriptionPrompt(intent)
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

export async function extractEmployeeLast4FromTranscript(
  transcript: string
): Promise<EmployeeLast4ExtractedFields> {
  const client = getClient();

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "Extract only the 4-digit employee number suffix from Korean transcript. Return null when missing. If uncertain, add validationErrors."
      },
      {
        role: "user",
        content: transcript
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: employeeLast4ExtractionSchema.name,
        schema: employeeLast4ExtractionSchema.schema,
        strict: true
      }
    }
  });

  const output = response.output_text;
  const parsed = JSON.parse(output) as EmployeeLast4ExtractedFields;
  return parsed;
}

export function extractConfirmationFromTranscript(transcript: string): ConfirmationExtractedFields {
  const compactTranscript = transcript.replace(/\s+/g, "").toLowerCase();
  const hasPositive = confirmationKeywords.positive.some((keyword) => compactTranscript.includes(keyword));
  const hasNegative = confirmationKeywords.negative.some((keyword) => compactTranscript.includes(keyword));

  if (hasPositive && !hasNegative) {
    return {
      confirmed: true,
      confidence: 0.95,
      validationErrors: []
    };
  }

  if (hasNegative && !hasPositive) {
    return {
      confirmed: false,
      confidence: 0.95,
      validationErrors: []
    };
  }

  return {
    confirmed: null,
    confidence: 0.2,
    validationErrors: ["confirmation could not be determined"]
  };
}

export function extractSelectionNumberFromTranscript(transcript: string): SelectionNumberExtractedFields {
  const compactTranscript = transcript.replace(/\s+/g, "").toLowerCase();
  const directNumberMatch = compactTranscript.match(/\d+/);

  if (directNumberMatch) {
    return {
      selectedNumber: Number(directNumberMatch[0]),
      confidence: 0.95,
      validationErrors: []
    };
  }

  const spokenMatch = spokenNumberPatterns.find((entry) =>
    entry.patterns.some((pattern) => compactTranscript.includes(pattern))
  );

  if (spokenMatch) {
    return {
      selectedNumber: spokenMatch.value,
      confidence: 0.85,
      validationErrors: []
    };
  }

  return {
    selectedNumber: null,
    confidence: 0.2,
    validationErrors: ["selection number could not be determined"]
  };
}
