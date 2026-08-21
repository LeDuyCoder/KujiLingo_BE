import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { authGuard } from "../../common/middlewares/auth.guard.js";
import {
    createFolderBodySchema,
    updateFolderBodySchema,
    folderIdParamsSchema,
    addSystemVocabBodySchema,
    removeSystemVocabParamsSchema,
    addUserVocabBodySchema,
    removeUserVocabParamsSchema
} from "./folder.schema.js";
import { addSystemVocabHandler, addUserVocabHandler, createFolderHandler, deleteFolderHandler, getFolderContentsHandler, listFoldersHandler, removeSystemVocabHandler, removeUserVocabHandler, updateFolderHandler } from "./folder.controller.js";

/**
 * Fastify plugin registering all Folder Module routes.
 * Includes routes for CRUD operations on folders and managing associations (system/user vocabularies).
 * All endpoints are secured under the `authGuard` middleware.
 * @param app Fastify Instance
 */
export async function folderRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    // 1. List Folders
    router.get(
        "/folders",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["Folder"],
                summary: "List Folders"
            }
        },
        listFoldersHandler as any
    );

    // 2. Create Folder
    router.post(
        "/folders",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["Folder"],
                summary: "Create Folder",
                body: createFolderBodySchema
            }
        },
        createFolderHandler as any
    );

    // 3. Update Folder
    router.put(
        "/folders/:id",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["Folder"],
                summary: "Update Folder",
                params: folderIdParamsSchema,
                body: updateFolderBodySchema
            }
        },
        updateFolderHandler as any
    );

    // 4. Delete Folder
    router.delete(
        "/folders/:id",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["Folder"],
                summary: "Delete Folder",
                params: folderIdParamsSchema
            }
        },
        deleteFolderHandler as any
    );

    // 5. Get Folder Contents
    router.get(
        "/folders/:id/contents",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["Folder"],
                summary: "Get Folder Contents",
                params: folderIdParamsSchema
            }
        },
        getFolderContentsHandler as any
    );

    // 6. Add System Vocabulary to Folder
    router.post(
        "/folders/:id/system-vocabularies",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["Folder"],
                summary: "Add System Vocabulary to Folder",
                params: folderIdParamsSchema,
                body: addSystemVocabBodySchema
            }
        },
        addSystemVocabHandler as any
    );

    // 7. Remove System Vocabulary from Folder
    router.delete(
        "/folders/:id/system-vocabularies/:vocabularyId",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["Folder"],
                summary: "Remove System Vocabulary from Folder",
                params: removeSystemVocabParamsSchema
            }
        },
        removeSystemVocabHandler as any
    );

    // 8. Add User Vocabulary to Folder
    router.post(
        "/folders/:id/user-vocabularies",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["Folder"],
                summary: "Add User Vocabulary to Folder",
                params: folderIdParamsSchema,
                body: addUserVocabBodySchema
            }
        },
        addUserVocabHandler as any
    );

    // 9. Remove User Vocabulary from Folder
    router.delete(
        "/folders/:id/user-vocabularies/:userVocabularyId",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["Folder"],
                summary: "Remove User Vocabulary from Folder",
                params: removeUserVocabParamsSchema
            }
        },
        removeUserVocabHandler as any
    );
}
