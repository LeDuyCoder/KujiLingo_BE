import z from "zod";

/**
 * Zod schema for validating the body of a request to create a new folder.
 */
export const createFolderBodySchema = z.object({
    name: z.string().trim().min(1, "name is required").max(150),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color format (e.g., #FF6B6B)").optional(),
    icon: z.string().max(50).optional()
});

/**
 * Zod schema for validating the body of a request to update an existing folder.
 */
export const updateFolderBodySchema = createFolderBodySchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided for update.", path: ["_root"] }
);

/**
 * Zod schema for validating folder ID path parameters.
 */
export const folderIdParamsSchema = z.object({
    id: z.string().uuid("id must be a valid UUID")
});

/**
 * Zod schema for validating the body of a request to add system vocabulary to a folder.
 */
export const addSystemVocabBodySchema = z.object({
    vocabulary_id: z.string().uuid("vocabulary_id must be a valid UUID")
});

/**
 * Zod schema for validating path parameters to remove system vocabulary from a folder.
 */
export const removeSystemVocabParamsSchema = z.object({
    id: z.string().uuid("id must be a valid UUID"),
    vocabularyId: z.string().uuid("vocabularyId must be a valid UUID")
});

/**
 * Zod schema for validating the body of a request to add user vocabulary to a folder.
 */
export const addUserVocabBodySchema = z.object({
    user_vocabulary_id: z.string().uuid("user_vocabulary_id must be a valid UUID")
});

/**
 * Zod schema for validating path parameters to remove user vocabulary from a folder.
 */
export const removeUserVocabParamsSchema = z.object({
    id: z.string().uuid("id must be a valid UUID"),
    userVocabularyId: z.string().uuid("userVocabularyId must be a valid UUID")
});

export type CreateFolderBody = z.infer<typeof createFolderBodySchema>;
export type UpdateFolderBody = z.infer<typeof updateFolderBodySchema>;
export type FolderIdParams = z.infer<typeof folderIdParamsSchema>;
export type AddSystemVocabBody = z.infer<typeof addSystemVocabBodySchema>;
export type RemoveSystemVocabParams = z.infer<typeof removeSystemVocabParamsSchema>;
export type AddUserVocabBody = z.infer<typeof addUserVocabBodySchema>;
export type RemoveUserVocabParams = z.infer<typeof removeUserVocabParamsSchema>;