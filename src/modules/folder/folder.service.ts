import { folderRepository } from "./folder.repository.js";
import type { FolderContentsDTO, FolderDTO } from "./folder.types.js";

/**
 * Service orchestrator containing business logic for Folders.
 */
export const folderService = {
    /**
     * Lists all folders for a given user with aggregated vocabulary counts.
     * @param userId User UUID
     * @returns List of folders mapped to FolderDTO
     */
    async listFolders(userId: string): Promise<FolderDTO[]> {
        const folders = await folderRepository.findByUser(userId);
        const folderIds = folders.map(f => f.id);

        if (folderIds.length === 0) return [];

        const [systemCounts, userCounts] = await Promise.all([
            folderRepository.getSystemVocabCounts(folderIds),
            folderRepository.getUserVocabCounts(folderIds)
        ]);

        const systemCountMap = new Map(systemCounts.map(c => [c.folder_id, c._count.vocabulary_id]));
        const userCountMap = new Map(userCounts.map(c => [c.folder_id, c._count.user_vocabulary_id]));

        return folders.map(f => ({
            id: f.id,
            name: f.name || "",
            color: f.color,
            icon: f.icon,
            system_vocab_count: systemCountMap.get(f.id) || 0,
            user_vocab_count: userCountMap.get(f.id) || 0
        }));
    },

    /**
     * Creates a new folder.
     * @param userId User UUID
     * @param name Name of the folder
     * @param color Custom hex color
     * @param icon Custom icon name
     * @returns The created folder record
     */
    async createFolder(userId: string, name: string, color?: string, icon?: string) {
        return folderRepository.create(userId, name, color, icon);
    },

    /**
     * Updates an existing folder owned by the user.
     * @param id Folder UUID
     * @param userId User UUID
     * @param name Optional new name
     * @param color Optional new hex color
     * @param icon Optional new icon name
     * @returns The updated folder record
     * @throws Error "FOLDER_NOT_FOUND" if folder not found or not owned
     */
    async updateFolder(id: string, userId: string, name?: string, color?: string, icon?: string) {
        const folder = await folderRepository.findByIdAndUser(id, userId);
        if (!folder) {
            throw new Error("FOLDER_NOT_FOUND");
        }

        return folderRepository.update(id, name, color, icon);
    },

    /**
     * Deletes a folder and all its items associations.
     * @param id Folder UUID
     * @param userId User UUID
     * @throws Error "FOLDER_NOT_FOUND" if folder not found or not owned
     */
    async deleteFolder(id: string, userId: string) {
        const folder = await folderRepository.findByIdAndUser(id, userId);
        if (!folder) {
            throw new Error("FOLDER_NOT_FOUND");
        }

        await folderRepository.delete(id);
    },

    /**
     * Resolves the complete contents of a folder.
     * Maps vocabulary item meanings based on the user's preferred language.
     * @param id Folder UUID
     * @param userId User UUID
     * @param preferredLang Preferred language header (e.g. "vi" or "en")
     * @returns Mapped folder contents containing arrays of system and user vocab
     * @throws Error "FOLDER_NOT_FOUND" if folder not found or not owned
     */
    async getFolderContents(id: string, userId: string, preferredLang = "vi"): Promise<FolderContentsDTO> {
        const folder = await folderRepository.findByIdAndUser(id, userId);
        if (!folder) {
            throw new Error("FOLDER_NOT_FOUND");
        }

        const [systemItems, userItems] = await Promise.all([
            folderRepository.getSystemVocabulariesInFolder(id),
            folderRepository.getUserVocabulariesInFolder(id)
        ]);

        const formattedSystem = systemItems.map(item => {
            const vocab = item.vocabularies;
            const meaning = vocab.vocabulary_meanings?.find(m => m.language === preferredLang)?.meaning
                || vocab.vocabulary_meanings?.find(m => m.language === "vi")?.meaning
                || vocab.vocabulary_meanings?.[0]?.meaning
                || null;

            return {
                id: vocab.id,
                kanji: vocab.kanji,
                hiragana: vocab.hiragana,
                meaning,
                jlpt: vocab.jlpt || null
            };
        });

        const formattedUser = userItems.map(item => {
            const uv = item.user_vocabularies;
            return {
                id: uv.id,
                kanji: uv.kanji,
                hiragana: uv.hiragana,
                meaning: uv.meaning,
                note: uv.note
            };
        });

        return {
            folder_id: folder.id,
            name: folder.name || "",
            system_vocabularies: formattedSystem,
            user_vocabularies: formattedUser
        };
    },

    /**
     * Saves a platform vocabulary item to a folder.
     * Performs ownership checks and ensures duplicate records are prevented.
     * @param folderId Folder UUID
     * @param userId User UUID
     * @param vocabId Vocabulary UUID
     * @throws Error "FOLDER_NOT_FOUND" if folder not found or not owned
     * @throws Error "INVALID_VOCABULARY_REFERENCE" if vocabulary does not exist
     * @throws Error "ALREADY_IN_FOLDER" if the item is already added
     */
    async addSystemVocab(folderId: string, userId: string, vocabId: string) {
        const folder = await folderRepository.findByIdAndUser(folderId, userId);
        if (!folder) {
            throw new Error("FOLDER_NOT_FOUND");
        }
        const vocabExists = await folderRepository.findSystemVocabById(vocabId);
        if (!vocabExists) {
            throw new Error("INVALID_VOCABULARY_REFERENCE");
        }
        const alreadyInFolder = await folderRepository.isSystemVocabInFolder(folderId, vocabId);
        if (alreadyInFolder) {
            throw new Error("ALREADY_IN_FOLDER");
        }
        await folderRepository.addSystemVocab(folderId, vocabId);
    },

    /**
     * Removes a platform vocabulary item from a folder.
     * @param folderId Folder UUID
     * @param userId User UUID
     * @param vocabId Vocabulary UUID
     * @throws Error "FOLDER_NOT_FOUND" if folder not found or not owned
     */
    async removeSystemVocab(folderId: string, userId: string, vocabId: string) {
        const folder = await folderRepository.findByIdAndUser(folderId, userId);
        if (!folder) {
            throw new Error("FOLDER_NOT_FOUND");
        }
        const exists = await folderRepository.isSystemVocabInFolder(folderId, vocabId);
        if (exists) {
            await folderRepository.removeSystemVocab(folderId, vocabId);
        }
    },

    /**
     * Saves a user-defined vocabulary item to a folder.
     * Verifies that the user vocabulary is owned by the calling user.
     * @param folderId Folder UUID
     * @param userId User UUID
     * @param userVocabId User vocabulary UUID
     * @throws Error "FOLDER_NOT_FOUND" if folder not found or not owned
     * @throws Error "INVALID_USER_VOCABULARY_REFERENCE" if user vocabulary not found or not owned
     * @throws Error "ALREADY_IN_FOLDER" if the item is already added
     */
    async addUserVocab(folderId: string, userId: string, userVocabId: string) {
        const folder = await folderRepository.findByIdAndUser(folderId, userId);
        if (!folder) {
            throw new Error("FOLDER_NOT_FOUND");
        }
        const userVocabExists = await folderRepository.findUserVocabByIdAndUser(userVocabId, userId);
        if (!userVocabExists) {
            throw new Error("INVALID_USER_VOCABULARY_REFERENCE");
        }
        const alreadyInFolder = await folderRepository.isUserVocabInFolder(folderId, userVocabId);
        if (alreadyInFolder) {
            throw new Error("ALREADY_IN_FOLDER");
        }
        await folderRepository.addUserVocab(folderId, userVocabId);
    },

    /**
     * Removes a user-defined vocabulary item from a folder.
     * @param folderId Folder UUID
     * @param userId User UUID
     * @param userVocabId User vocabulary UUID
     * @throws Error "FOLDER_NOT_FOUND" if folder not found or not owned
     */
    async removeUserVocab(folderId: string, userId: string, userVocabId: string) {
        const folder = await folderRepository.findByIdAndUser(folderId, userId);
        if (!folder) {
            throw new Error("FOLDER_NOT_FOUND");
        }
        const exists = await folderRepository.isUserVocabInFolder(folderId, userVocabId);
        if (exists) {
            await folderRepository.removeUserVocab(folderId, userVocabId);
        }
    }
};