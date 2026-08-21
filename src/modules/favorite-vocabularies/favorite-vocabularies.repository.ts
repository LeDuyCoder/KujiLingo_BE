import { prisma } from "../../config/prisma.js";

export const favoriteVocabulariesRepository = {
    /**
     * Lấy danh sách từ vựng yêu thích của user kèm thông tin nghĩa theo ngôn ngữ
     */
    async findByUser(userId: string, language: string, page: number, limit: number) {
        const offset = (page - 1) * limit;

        const [favorites, total] = await Promise.all([
            prisma.favorite_vocabularies.findMany({
                where: { user_id: userId },
                skip: offset,
                take: limit,
                include: {
                    vocabularies: {
                        select: {
                            id: true,
                            kanji: true,
                            hiragana: true,
                            jlpt: true,
                            vocabulary_meanings: {
                                where: { language },
                                orderBy: { display_order: "asc" },
                                take: 1,
                                select: {
                                    meaning: true,
                                },
                            },
                        },
                    },
                },
            }),
            prisma.favorite_vocabularies.count({
                where: { user_id: userId },
            }),
        ]);

        return { favorites, total };
    },

    /**
     * Kiểm tra từ vựng có tồn tại trong cơ sở dữ liệu hay không
     */
    async existsVocabulary(vocabularyId: string): Promise<boolean> {
        const count = await prisma.vocabularies.count({
            where: { id: vocabularyId },
        });
        return count > 0;
    },

    /**
     * Thêm từ vựng vào danh sách yêu thích
     */
    async addFavorite(userId: string, vocabularyId: string) {
        return prisma.favorite_vocabularies.create({
            data: {
                user_id: userId,
                vocabulary_id: vocabularyId,
            },
        });
    },

    /**
     * Xóa từ vựng khỏi danh sách yêu thích
     */
    async removeFavorite(userId: string, vocabularyId: string) {
        return prisma.favorite_vocabularies.deleteMany({
            where: {
                user_id: userId,
                vocabulary_id: vocabularyId,
            },
        });
    },
};
