import { z } from "zod";

export const MemberStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export type MemberStatus = z.infer<typeof MemberStatusSchema>;

export const MemberRoleSchema = z.enum(["MEMBER", "ADMIN"]);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

export const FoodStatusSchema = z.enum(["REGISTERED", "TAKEN_OUT", "DISPOSED", "EXPIRED"]);
export type FoodStatus = z.infer<typeof FoodStatusSchema>;

export const ScheduleTypeSchema = z.enum([
  "OWNER_D_MINUS_3",
  "OWNER_D_DAY",
  "OWNER_D_PLUS_7",
  "OWNER_WEEKLY",
  "ADMIN_D_PLUS_7"
]);
export type ScheduleType = z.infer<typeof ScheduleTypeSchema>;

export const NotificationStatusSchema = z.enum([
  "PENDING",
  "SENT",
  "FAILED_RETRY",
  "FAILED_PERM",
  "CANCELED"
]);
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;

export const TargetTypeSchema = z.enum(["OWNER", "ADMIN"]);
export type TargetType = z.infer<typeof TargetTypeSchema>;

export const EmployeeLookupRequestSchema = z.object({
  employeeNo: z.string().min(1)
});

export const EmployeeLookupResponseSchema = z.object({
  memberId: z.string(),
  employeeNo: z.string(),
  name: z.string(),
  department: z.string(),
  email: z.string().email(),
  status: MemberStatusSchema,
  role: MemberRoleSchema
});

export const NameLookupRequestSchema = z.object({
  nameQuery: z.string().min(1)
});

export const NameLookupCandidateSchema = z.object({
  memberId: z.string(),
  name: z.string(),
  department: z.string(),
  employeeNoLast4: z.string(),
  email: z.string().email(),
  status: MemberStatusSchema,
  role: MemberRoleSchema
});

export const NameLookupResponseSchema = z.object({
  candidates: z.array(NameLookupCandidateSchema)
});

export const UploadUrlRequestSchema = z.object({
  kind: z.enum(["photo", "audio"]),
  contentType: z.string().min(1)
});

export const CreateFoodRequestSchema = z.object({
  memberId: z.string().uuid(),
  foodName: z.string().min(1).max(120),
  expiryDate: z.string().date(),
  photoObjectKey: z.string().min(1),
  audioObjectKey: z.string().min(1).optional()
});

export const UpdateFoodRequestSchema = z
  .object({
    foodName: z.string().min(1).max(120).optional(),
    expiryDate: z.string().date().optional(),
    status: FoodStatusSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

export const TranscribeResponseSchema = z.object({
  transcript: z.string(),
  intent: z.enum(["IDENTITY_NAME", "FOOD_INFO", "EMPLOYEE_LAST4", "CONFIRMATION", "SELECTION_NUMBER"]),
  extracted: z.union([
    z.object({
      nameCandidate: z.string().nullable(),
      confidence: z.number().min(0).max(1)
    }),
    z.object({
      foodName: z.string().nullable(),
      expiryDate: z.string().nullable(),
      confidence: z.number().min(0).max(1)
    }),
    z.object({
      employeeNoLast4: z.string().nullable(),
      confidence: z.number().min(0).max(1)
    }),
    z.object({
      confirmed: z.boolean().nullable(),
      confidence: z.number().min(0).max(1)
    }),
    z.object({
      selectedNumber: z.number().int().positive().nullable(),
      confidence: z.number().min(0).max(1)
    })
  ]),
  validationErrors: z.array(z.string())
});
