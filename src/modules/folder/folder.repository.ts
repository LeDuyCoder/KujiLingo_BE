import { prisma } from "../../config/prisma.js";
import crypto from "node:crypto";

/**
 * Repository handler for performing raw database operations relating to folders.
 */
export const folderRepository = {
    /**
     * Finds all folders owned by a specific user.
     * @param userId User UUID
     * @returns List of matching folders ordered alphabetically by name
     */
    async findByUser(userId: string) {
        return prisma.folders.findMany({
            where: { user_id: userId },
            orderBy: { name: "asc" },
        });
    },

    /**
     * Finds a folder by its ID and owner's user ID.
     * @param id Folder UUID
     * @param userId User UUID
     * @returns The folder if found and owned, otherwise null
     */
    async findByIdAndUser(id: string, userId: string) {
        return prisma.folders.findFirst({
            where: { id, user_id: userId }
        });
    },

    /**
     * Groups and counts system vocabulary items inside specified folders.
     * @param folderIds Array of Folder UUIDs
     * @returns Aggregated counts grouped by folder_id
     */
    async getSystemVocabCounts(folderIds: string[]) {
        return prisma.folder_system_vocabularies.groupBy({
            by: ["folder_id"],
            where: { folder_id: { in: folderIds } },
            _count: { vocabulary_id: true }
        });
    },

    /**
     * Groups and counts user-defined vocabulary items inside specified folders.
     * @param folderIds Array of Folder UUIDs
     * @returns Aggregated counts grouped by folder_id
     */
    async getUserVocabCounts(folderIds: string[]) {
        return prisma.folder_user_vocabularies.groupBy({
            by: ["folder_id"],
            where: { folder_id: { in: folderIds } },
            _count: { user_vocabulary_id: true }
        })
    },

    /**
     * Creates a new folder.
     * @param userId Owner's user UUID
     * @param name Folder display name
     * @param color Folder hex color
     * @param icon Folder icon identifier
     * @returns The newly created folder
     */
    async create(userId: string, name: string, color?: string, icon?: string) {
        const createData: any = {
            id: crypto.randomUUID(),
            user_id: userId,
            name
        };

        if (color !== undefined) createData.color = color;
        if (icon !== undefined) createData.icon = icon;

        return await prisma.folders.create({ data: createData });
    },

    /**
     * Updates fields on an existing folder.
     * @param id Folder UUID
     * @param name Optional new name
     * @param color Optional new hex color
     * @param icon Optional new icon identifier
     * @returns The updated folder
     */
    async update(id: string, name?: string, color?: string, icon?: string) {
        const updateData: any = {};

        if (name !== undefined) updateData.name = name;
        if (color !== undefined) updateData.color = color;
        if (icon !== undefined) updateData.icon = icon;

        return prisma.folders.update({
            where: { id },
            data: updateData
        });
    },

    /**
     * Deletes a folder and all its associations inside an atomic database transaction.
     * @param id Folder UUID
     * @returns Transaction result
     */
    async delete(id: string) {
        return prisma.$transaction([
            prisma.folder_system_vocabularies.deleteMany({ where: { folder_id: id } }),
            prisma.folder_user_vocabularies.deleteMany({ where: { folder_id: id } }),
            prisma.folders.delete({ where: { id } })
        ]);
    },

    /**
     * Finds a system vocabulary by its ID.
     * @param vocabId Vocabulary UUID
     * @returns The vocabulary item if found
     */
    async findSystemVocabById(vocabId: string) {
        return prisma.vocabularies.findUnique({
            where: { id: vocabId }
        });
    },

    /**
     * Finds a user vocabulary by its ID and checks if it's owned by the user.
     * @param userVocabId User vocabulary UUID
     * @param userId Owner's user UUID
     * @returns The user vocabulary if found and owned
     */
    async findUserVocabByIdAndUser(userVocabId: string, userId: string) {
        return prisma.user_vocabularies.findFirst({
            where: { id: userVocabId, user_id: userId }
        });
    },

    /**
     * Checks if a system vocabulary item is already saved in a folder.
     * @param folderId Folder UUID
     * @param vocabId Vocabulary UUID
     * @returns Boolean true/false
     */
    async isSystemVocabInFolder(folderId: string, vocabId: string) {
        const record = await prisma.folder_system_vocabularies.findUnique({
            where: {
                folder_id_vocabulary_id: {
                    folder_id: folderId,
                    vocabulary_id: vocabId
                }
            }
        });
        return !!record;
    },

    /**
     * Checks if a user vocabulary item is already saved in a folder.
     * @param folderId Folder UUID
     * @param userVocabId User vocabulary UUID
     * @returns Boolean true/false
     */
    async isUserVocabInFolder(folderId: string, userVocabId: string) {
        const record = await prisma.folder_user_vocabularies.findUnique({
            where: {
                folder_id_user_vocabulary_id: {
                    folder_id: folderId,
                    user_vocabulary_id: userVocabId
                }
            }
        });
        return !!record;
    },

    /**
     * Adds a system vocabulary item to a folder.
     * @param folderId Folder UUID
     * @param vocabId Vocabulary UUID
     */
    async addSystemVocab(folderId: string, vocabId: string) {
        return prisma.folder_system_vocabularies.create({
            data: {
                folder_id: folderId,
                vocabulary_id: vocabId
            }
        });
    },

    /**
     * Adds a user vocabulary item to a folder.
     * @param folderId Folder UUID
     * @param userVocabId User vocabulary UUID
     */
    async addUserVocab(folderId: string, userVocabId: string) {
        return prisma.folder_user_vocabularies.create({
            data: {
                folder_id: folderId,
                user_vocabulary_id: userVocabId
            }
        });
    },

    /**
     * Removes a system vocabulary item from a folder.
     * @param folderId Folder UUID
     * @param vocabId Vocabulary UUID
     */
    async removeSystemVocab(folderId: string, vocabId: string) {
        return prisma.folder_system_vocabularies.delete({
            where: {
                folder_id_vocabulary_id: {
                    folder_id: folderId,
                    vocabulary_id: vocabId
                }
            }
        });
    },

    /**
     * Removes a user vocabulary item from a folder.
     * @param folderId Folder UUID
     * @param userVocabId User vocabulary UUID
     */
    async removeUserVocab(folderId: string, userVocabId: string) {
        return prisma.folder_user_vocabularies.delete({
            where: {
                folder_id_user_vocabulary_id: {
                    folder_id: folderId,
                    user_vocabulary_id: userVocabId
                }
            }
        });
    },

    /**
     * Resolves all system vocabularies saved in a folder including their meanings.
     * @param folderId Folder UUID
     * @returns Array of system vocabularies with relations
     */
    async getSystemVocabulariesInFolder(folderId: string) {
        return prisma.folder_system_vocabularies.findMany({
            where: { folder_id: folderId },
            include: {
                vocabularies: {
                    include: {
                        vocabulary_meanings: true
                    }
                }
            }
        });
    },

    /**
     * Resolves all user vocabularies saved in a folder.
     * @param folderId Folder UUID
     * @returns Array of user vocabularies with relations
     */
    async getUserVocabulariesInFolder(folderId: string) {
        return prisma.folder_user_vocabularies.findMany({
            where: { folder_id: folderId },
            include: {
                user_vocabularies: true
            }
        });
    }
};