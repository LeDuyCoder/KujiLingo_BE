import type { FastifyInstance } from "fastify";
import { authRoutes } from "../modules/auth/index.js";
import { adminRoutes } from "../modules/admin/index.js";
import { coursesRoutes } from "../modules/courses/index.js";
import { dashboardRoutes } from "../modules/dashboard/dashboard.routes.js";
import { dictionaryRoutes } from "../modules/dictionary/dictionary.routes.js";
import { favoriteVocabulariesRoutes } from "../modules/favorite-vocabularies/index.js";
import { grammarRoutes } from "../modules/grammar/index.js";
import { folderRoutes } from "../modules/folder/folder.routes.js";
import { kanjiRoutes } from "../modules/kanji/kanji.routes.js";
import { leaderboardRoutes } from "../modules/leaderboard/index.js";
import { learningProgressRoutes } from "../modules/learning-progress/index.js";
import { lessonsRoutes } from "../modules/lessons/index.js";
import { topicsRoutes } from "../modules/topics/index.js";
import { shopRoutes } from "../modules/shop/index.js";
import { gemsRoutes } from "../modules/gems/index.js";

export async function registerRoutes(app: FastifyInstance) {
    await app.register(authRoutes);
    await app.register(adminRoutes);
    await app.register(coursesRoutes);
    await app.register(dashboardRoutes);
    await app.register(dictionaryRoutes);
    await app.register(favoriteVocabulariesRoutes);
    await app.register(grammarRoutes);
    await app.register(folderRoutes);
    await app.register(kanjiRoutes);
    await app.register(leaderboardRoutes);
    await app.register(learningProgressRoutes);
    await app.register(gemsRoutes);
    await app.register(lessonsRoutes);
    await app.register(topicsRoutes);
    await app.register(shopRoutes);
}
