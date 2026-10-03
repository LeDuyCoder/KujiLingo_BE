import type { FastifyReply, FastifyRequest } from "fastify";
import { folderService } from "./folder.service.js";
import type {
    CreateFolderBody,
    UpdateFolderBody,
    FolderIdParams,
    AddSystemVocabBody,
    RemoveSystemVocabParams,
    AddUserVocabBody,
    RemoveUserVocabParams
} from "./folder.schema.js";

/**
 * Controller handler to list all folders belonging to the authenticated user.
 * @route GET /folders
 */
export async function listFoldersHandler(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user!.id;
    const result = await folderService.listFolders(userId);
    return reply.code(200).send({ success: true, data: result });
}

/**
 * Controller handler to create a new folder.
 * @route POST /folders
 */
export async function createFolderHandler(
    request: FastifyRequest<{ Body: CreateFolderBody }>,
    reply: FastifyReply
) {
    const userId = request.user!.id;
    const { name, color, icon } = request.body;
    const result = await folderService.createFolder(userId, name, color, icon);
    return reply.code(201).send({
        success: true,
        data: {
            id: result.id,
            name: result.name,
            color: result.color,
            icon: result.icon
        },
        message: "Folder created successfully."
    });
}

/**
 * Controller handler to update fields on an existing folder.
 * @route PUT /folders/:id
 */
export async function updateFolderHandler(
    request: FastifyRequest<{ Params: FolderIdParams; Body: UpdateFolderBody }>,
    reply: FastifyReply
) {
    const userId = request.user!.id;
    const { id } = request.params;
    const { name, color, icon } = request.body;

    try {
        const result = await folderService.updateFolder(id, userId, name, color, icon);
        return reply.code(200).send({
            success: true,
            data: {
                id: result.id,
                name: result.name,
                color: result.color,
                icon: result.icon
            },
            message: "Folder updated successfully."
        });
    } catch (error: any) {
        if (error.message === "FOLDER_NOT_FOUND") {
            return reply.code(404).send({ success: false, error: { code: "FOLDER_NOT_FOUND", message: "Folder not found or not owned by caller." } });
        }
        throw error;
    }
}

/**
 * Controller handler to delete an existing folder.
 * @route DELETE /folders/:id
 */
export async function deleteFolderHandler(
    request: FastifyRequest<{ Params: FolderIdParams }>,
    reply: FastifyReply
) {
    const userId = request.user!.id;
    const { id } = request.params;

    try {
        await folderService.deleteFolder(id, userId);
        return reply.code(200).send({ success: true, message: "Folder deleted successfully." });
    } catch (error: any) {
        if (error.message === "FOLDER_NOT_FOUND") {
            return reply.code(404).send({ success: false, error: { code: "FOLDER_NOT_FOUND", message: "Folder not found or not owned by caller." } });
        }
        throw error;
    }
}

/**
 * Controller handler to resolve and fetch the contents (vocab lists) of a folder.
 * @route GET /folders/:id/contents
 */
export async function getFolderContentsHandler(
    request: FastifyRequest<{ Params: FolderIdParams }>,
    reply: FastifyReply
) {
    const userId = request.user!.id;
    const { id } = request.params;

    // Detect user language preference
    const acceptLang = request.headers["accept-language"] || "vi";
    const preferredLang = acceptLang.startsWith("en") ? "en" : "vi";

    try {
        const result = await folderService.getFolderContents(id, userId, preferredLang);
        return reply.code(200).send({ success: true, data: result });
    } catch (error: any) {
        if (error.message === "FOLDER_NOT_FOUND") {
            return reply.code(404).send({ success: false, error: { code: "FOLDER_NOT_FOUND", message: "Folder not found or not owned by caller." } });
        }
        throw error;
    }
}

/**
 * Controller handler to add a system vocabulary item to a folder.
 * @route POST /folders/:id/system-vocabularies
 */
export async function addSystemVocabHandler(
    request: FastifyRequest<{ Params: FolderIdParams; Body: AddSystemVocabBody }>,
    reply: FastifyReply
) {
    const userId = request.user!.id;
    const { id: folderId } = request.params;
    const { vocabulary_id: vocabId } = request.body;

    try {
        await folderService.addSystemVocab(folderId, userId, vocabId);
        return reply.code(201).send({ success: true, message: "Vocabulary added to folder." });
    } catch (error: any) {
        if (error.message === "FOLDER_NOT_FOUND") {
            return reply.code(404).send({ success: false, error: { code: "FOLDER_NOT_FOUND", message: "Folder not found or not owned." } });
        }
        if (error.message === "INVALID_VOCABULARY_REFERENCE") {
            return reply.code(422).send({ success: false, error: { code: "INVALID_VOCABULARY_REFERENCE", message: "vocabulary_id not found." } });
        }
        if (error.message === "ALREADY_IN_FOLDER") {
            return reply.code(409).send({ success: false, error: { code: "ALREADY_IN_FOLDER", message: "Duplicate entry." } });
        }
        throw error;
    }
}

/**
 * Controller handler to remove a system vocabulary item from a folder.
 * @route DELETE /folders/:id/system-vocabularies/:vocabularyId
 */
export async function removeSystemVocabHandler(
    request: FastifyRequest<{ Params: RemoveSystemVocabParams }>,
    reply: FastifyReply
) {
    const userId = request.user!.id;
    const { id: folderId, vocabularyId: vocabId } = request.params;

    try {
        await folderService.removeSystemVocab(folderId, userId, vocabId);
        return reply.code(200).send({ success: true, message: "Vocabulary removed from folder." });
    } catch (error: any) {
        if (error.message === "FOLDER_NOT_FOUND") {
            return reply.code(404).send({ success: false, error: { code: "FOLDER_NOT_FOUND", message: "Folder not found or not owned." } });
        }
        throw error;
    }
}

/**
 * Controller handler to add a user vocabulary item to a folder.
 * @route POST /folders/:id/user-vocabularies
 */
export async function addUserVocabHandler(
    request: FastifyRequest<{ Params: FolderIdParams; Body: AddUserVocabBody }>,
    reply: FastifyReply
) {
    const userId = request.user!.id;
    const { id: folderId } = request.params;
    const { user_vocabulary_id: userVocabId } = request.body;

    try {
        await folderService.addUserVocab(folderId, userId, userVocabId);
        return reply.code(201).send({ success: true, message: "Word added to folder." });
    } catch (error: any) {
        if (error.message === "FOLDER_NOT_FOUND") {
            return reply.code(404).send({ success: false, error: { code: "FOLDER_NOT_FOUND", message: "Folder not found or not owned." } });
        }
        if (error.message === "INVALID_USER_VOCABULARY_REFERENCE") {
            return reply.code(422).send({ success: false, error: { code: "INVALID_USER_VOCABULARY_REFERENCE", message: "User vocab not found or not owned by caller." } });
        }
        if (error.message === "ALREADY_IN_FOLDER") {
            return reply.code(409).send({ success: false, error: { code: "ALREADY_IN_FOLDER", message: "Duplicate entry." } });
        }
        throw error;
    }
}

/**
 * Controller handler to remove a user vocabulary item from a folder.
 * @route DELETE /folders/:id/user-vocabularies/:userVocabularyId
 */
export async function removeUserVocabHandler(
    request: FastifyRequest<{ Params: RemoveUserVocabParams }>,
    reply: FastifyReply
) {
    const userId = request.user!.id;
    const { id: folderId, userVocabularyId: userVocabId } = request.params;

    try {
        await folderService.removeUserVocab(folderId, userId, userVocabId);
        return reply.code(200).send({ success: true, message: "Word removed from folder." });
    } catch (error: any) {
        if (error.message === "FOLDER_NOT_FOUND") {
            return reply.code(404).send({ success: false, error: { code: "FOLDER_NOT_FOUND", message: "Folder not found or not owned." } });
        }
        throw error;
    }
}
