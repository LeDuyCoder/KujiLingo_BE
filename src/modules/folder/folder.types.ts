/**
 * Data Transfer Object for a folder summary, including vocabulary counts.
 */
export interface FolderDTO {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
    system_vocab_count: number;
    user_vocab_count: number;
}

/**
 * Data Transfer Object for creating a new folder.
 */
export interface CreateFolderDTO {
    name: string;
    color?: string;
    icon?: string;
}

/**
 * Data Transfer Object for updating an existing folder.
 */
export interface UpdateFolderDTO {
    name?: string;
    color?: string;
    icon?: string;
}

/**
 * Data Transfer Object for a platform (system) vocabulary item within a folder.
 */
export interface SystemVocabularyFolderDTO {
    id: string;
    kanji: string | null;
    hiragana: string | null;
    meaning: string | null;
    jlpt: string | null;
}

/**
 * Data Transfer Object for a user-created vocabulary item within a folder.
 */
export interface UserVocabularyFolderDTO {
    id: string;
    kanji: string | null;
    hiragana: string | null;
    meaning: string | null;
    note: string | null;
}

/**
 * Data Transfer Object for the full contents of a folder.
 */
export interface FolderContentsDTO {
    folder_id: string;
    name: string;
    system_vocabularies: SystemVocabularyFolderDTO[];
    user_vocabularies: UserVocabularyFolderDTO[];
}